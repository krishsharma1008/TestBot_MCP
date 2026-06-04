/**
 * Inngest orchestrator — feature-based fan-out.
 *
 * Implements the 5-step generation flow from the refactoring plan:
 *
 *   Step 1: Parse PRD (already done by the time the job is queued)
 *   Step 2: Auth feature — blocking, always first
 *   Step 3: Feature loop — sequential across features; UI + API parallel within each
 *   Step 4: E2E generation — after all features complete
 *   Step 5: Dynamic playwright.config.ts — written by the MCP, not here
 *
 * Event contract (new shape):
 *   Input:    generation/job.requested        { jobId }
 *   Fan-out:  generation/feature.requested    { jobId, featureId, agentType, featureSlug }
 *   Wait on:  generation/feature.completed    { jobId, featureId, agentType, ok, errorCode? }
 *   Output:   generation/job.completed        { jobId, status, okCount, totalJobs }
 */

import { inngest } from '@/lib/inngest/client'
import { db } from '@/lib/db'
import { generationJobs } from '@/lib/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { detectAuthFeature } from '@/lib/test-generation/agent-dispatcher'
import type { ParsedPRD, FeatureAgentType, FeatureManifest, ActionSignature } from '@/lib/test-generation/types'

/** Extracts exported async function signatures from an actions file's content. */
function extractActionSignatures(content: string): ActionSignature[] {
  const re = /export\s+async\s+function\s+(\w+)\s*\(([^)]*)\)/g
  const sigs: ActionSignature[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    const rawParams = m[2].trim()
    const params = rawParams ? rawParams.split(',').map((p) => p.trim()).filter(Boolean) : []
    sigs.push({ name: m[1], params })
  }
  return sigs
}

interface JobRequestedEventData { jobId: string }

type FeatureOutcome = {
  featureId: string
  agentType: FeatureAgentType
  featureSlug: string
  ok: boolean
  errorCode?: string
}

type FinalStatus = 'succeeded' | 'failed' | 'partial'

export const generateTestsOrchestrator = inngest.createFunction(
  {
    id: 'generate-tests-orchestrator',
    retries: 1,
    concurrency: [{ limit: 50 }],
    triggers: [{ event: 'generation/job.requested' }],
  },
  async ({ event, step, logger }) => {
    const { jobId } = event.data as JobRequestedEventData

    // 1. Load job row
    const job = await step.run('load-job', async () => {
      const [row] = await db.select().from(generationJobs).where(eq(generationJobs.id, jobId))
      if (!row) return null
      return { id: row.id, userId: row.userId, status: row.status, payload: row.payload }
    })
    if (!job) {
      logger.warn({ jobId }, 'job not found, orchestrator exiting')
      return { ok: false, reason: 'job_not_found' }
    }

    // 2. Transition queued → running
    await step.run('mark-running', async () => {
      await db
        .update(generationJobs)
        .set({ status: 'running', startedAt: sql`COALESCE(started_at, now())` })
        .where(and(eq(generationJobs.id, jobId), eq(generationJobs.status, 'queued')))
    })

    // Extract parsedPRD and testType from frozen payload
    const payload = (job.payload || {}) as Record<string, unknown>
    const parsedPRD = (payload.parsedPRD || null) as ParsedPRD | null
    const testType = ((payload.testType as string) || 'both') as 'frontend' | 'backend' | 'both'

    if (!parsedPRD?.features?.length) {
      await step.run('finalize-no-prd', async () => {
        await db.update(generationJobs)
          .set({ status: 'failed', completedAt: new Date(), error: { reason: 'no_parsed_prd' } })
          .where(eq(generationJobs.id, jobId))
      })
      logger.warn({ jobId }, 'no parsedPRD in payload — job failed')
      return { ok: false, reason: 'no_parsed_prd' }
    }

    const featureOutcomes: FeatureOutcome[] = []

    // Helper to derive slug from feature name
    const toSlug = (name: string) =>
      name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'feature'

    // Unique slug per feature (collision-safe), keyed by feature id. Kept in
    // lockstep with the MCP's buildFeatureSlugMap so generated filenames and any
    // downstream playwright.config testMatch never collide on duplicate names.
    const slugByFeatureId = new Map<string, string>()
    {
      const seen = new Map<string, number>()
      for (const f of parsedPRD.features) {
        const base = toSlug(f.name)
        const n = (seen.get(base) || 0) + 1
        seen.set(base, n)
        slugByFeatureId.set(f.id, n === 1 ? base : `${base}-${n}`)
      }
    }
    const slugFor = (f: { id: string; name: string }) => slugByFeatureId.get(f.id) || toSlug(f.name)

    // ── Step 2: Auth feature (blocking) ────────────────────────────────────
    const authFeature = detectAuthFeature(parsedPRD)
    if (authFeature) {
      const authSlug = slugFor(authFeature)

      await step.sendEvent('fan-out-auth', {
        name: 'generation/feature.requested',
        data: { jobId, featureId: authFeature.id, agentType: 'auth', featureSlug: authSlug },
      })

      const authCompletion = await step.waitForEvent('wait-auth', {
        event: 'generation/feature.completed',
        timeout: '15m',
        if: `event.data.jobId == '${jobId}' && event.data.featureId == '${authFeature.id}' && event.data.agentType == 'auth'`,
      })

      featureOutcomes.push({
        featureId: authFeature.id,
        agentType: 'auth',
        featureSlug: authSlug,
        ok: authCompletion ? Boolean((authCompletion.data as { ok?: boolean }).ok) : false,
        errorCode: authCompletion ? ((authCompletion.data as { errorCode?: string }).errorCode) : 'AUTH_TIMEOUT',
      })
      logger.info({ jobId, authFeatureId: authFeature.id }, 'auth feature completed')
    }

    // ── Step 3: Feature loop (sequential, UI+API parallel within each) ────
    const nonAuthFeatures = parsedPRD.features.filter(
      (f) => !authFeature || f.id !== authFeature.id
    )

    for (const feature of nonAuthFeatures) {
      const featureSlug = slugFor(feature)

      // Determine which agents to run based on testType
      const agentTypes: FeatureAgentType[] =
        testType === 'frontend' ? ['ui']
        : testType === 'backend' ? ['api']
        : ['ui', 'api']

      // Fan out UI and/or API for this feature in parallel
      await step.sendEvent(`fan-out-${featureSlug}`, agentTypes.map((agentType) => ({
        name: 'generation/feature.requested',
        data: { jobId, featureId: feature.id, agentType, featureSlug },
      })))

      // Wait for all agents for this feature before moving to the next feature
      const completions = await Promise.all(
        agentTypes.map((agentType) =>
          step.waitForEvent(`wait-${featureSlug}-${agentType}`, {
            event: 'generation/feature.completed',
            timeout: '15m',
            if: `event.data.jobId == '${jobId}' && event.data.featureId == '${feature.id}' && event.data.agentType == '${agentType}'`,
          })
        )
      )

      agentTypes.forEach((agentType, i) => {
        const ev = completions[i]
        featureOutcomes.push({
          featureId: feature.id,
          agentType,
          featureSlug,
          ok: ev ? Boolean((ev.data as { ok?: boolean }).ok) : false,
          errorCode: ev ? ((ev.data as { errorCode?: string }).errorCode) : 'FEATURE_TIMEOUT',
        })
      })

      logger.info({ jobId, featureId: feature.id, featureSlug }, 'feature agents completed')
    }

    // ── Step 3.5: Build feature manifest from accumulated *-actions.ts files ─
    // After all feature agents complete, scan job.result.tests for *-actions.ts
    // files written by UI agents and extract exported async function signatures.
    // Write the resulting manifest to job.result.featureManifest so the E2E
    // agent can compose cross-feature journeys using real action function names.
    await step.run('build-feature-manifest', async () => {
      const [row] = await db
        .select({ result: generationJobs.result })
        .from(generationJobs)
        .where(eq(generationJobs.id, jobId))
      if (!row) return

      type GeneratedFile = { filename?: string; path?: string; content?: string }
      const tests: GeneratedFile[] = Array.isArray((row.result as Record<string, unknown>)?.tests)
        ? ((row.result as Record<string, unknown>).tests as GeneratedFile[])
        : []

      // Build a slug→feature lookup from the non-auth features processed in Step 3
      const featureBySlug = new Map(
        nonAuthFeatures.map((f) => [slugFor(f), f])
      )

      const featureManifest: FeatureManifest[] = []
      for (const file of tests) {
        const filename = file.filename || file.path || ''
        if (!filename.endsWith('-actions.ts')) continue
        // Derive slug from "billing-actions.ts" → "billing"
        const slug = filename.replace(/-actions\.ts$/, '').replace(/^.*\//, '')
        const feature = featureBySlug.get(slug)
        if (!feature) continue

        const sigs: ActionSignature[] = extractActionSignatures(file.content || '')
        featureManifest.push({
          featureId: feature.id,
          featureSlug: slug,
          featureName: feature.name,
          actionsFile: filename,
          actions: sigs,
        })
      }

      if (featureManifest.length > 0) {
        const manifestJson = JSON.stringify(featureManifest)
        await db.execute(sql`
          UPDATE generation_jobs
          SET result = jsonb_set(
            COALESCE(result, '{}'::jsonb),
            '{featureManifest}',
            ${manifestJson}::jsonb
          )
          WHERE id = ${jobId}
        `)
      }
    })

    // ── Step 4: E2E generation (after all features) ────────────────────────
    await step.sendEvent('fan-out-e2e', {
      name: 'generation/feature.requested',
      data: { jobId, featureId: 'e2e', agentType: 'e2e', featureSlug: 'e2e' },
    })

    const e2eCompletion = await step.waitForEvent('wait-e2e', {
      event: 'generation/feature.completed',
      timeout: '15m',
      if: `event.data.jobId == '${jobId}' && event.data.featureId == 'e2e' && event.data.agentType == 'e2e'`,
    })

    featureOutcomes.push({
      featureId: 'e2e',
      agentType: 'e2e',
      featureSlug: 'e2e',
      ok: e2eCompletion ? Boolean((e2eCompletion.data as { ok?: boolean }).ok) : false,
      errorCode: e2eCompletion ? ((e2eCompletion.data as { errorCode?: string }).errorCode) : 'E2E_TIMEOUT',
    })

    // ── Step 5: Finalize ───────────────────────────────────────────────────
    const okCount = featureOutcomes.filter((o) => o.ok).length
    const totalJobs = featureOutcomes.length
    const finalStatus: FinalStatus =
      okCount === totalJobs ? 'succeeded'
      : okCount === 0 ? 'failed'
      : 'partial'

    await step.run('finalize', async () => {
      const outcomesJson = JSON.stringify(featureOutcomes)
      await db.update(generationJobs)
        .set({
          status: finalStatus,
          completedAt: new Date(),
          result: sql`jsonb_set(COALESCE(${generationJobs.result}, '{}'::jsonb), '{featureOutcomes}', ${outcomesJson}::jsonb)`,
        })
        .where(eq(generationJobs.id, jobId))
    })

    await step.sendEvent('job-done', {
      name: 'generation/job.completed',
      data: { jobId, status: finalStatus, okCount, totalJobs },
    })

    logger.info({ jobId, finalStatus, okCount, totalJobs }, 'orchestrator finalized')
    return { ok: true, finalStatus, okCount, totalJobs }
  }
)
