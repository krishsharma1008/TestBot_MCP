/**
 * Inngest background function — runs exactly ONE feature+agentType generation unit.
 *
 * Event contract (new shape):
 *   Input:  generation/feature.requested  { jobId, featureId, agentType, featureSlug }
 *   Output: generation/feature.completed  { jobId, featureId, agentType, ok, errorCode? }
 *
 * Replaces the old generation/agent.requested / generation/agent.completed contract.
 *
 * Concurrency:
 *   - 20 concurrent runs globally
 *   - 5 concurrent runs per jobId (matches max parallel UI+API across features)
 *
 * Idempotency:
 *   - agents_completed membership check uses `${featureId}:${agentType}` key
 *   - step.run is memoized across retries
 */

import { inngest } from '@/lib/inngest/client'
import { db } from '@/lib/db'
import { generationJobs } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { dispatchFeature } from '@/lib/test-generation/agent-dispatcher'
import type { FeatureAgentType, GenerateTestsParams, AgentRunRecord, FeatureManifest } from '@/lib/test-generation/types'
import { recordTokenUsage } from '@/lib/tokens'
import { resolveModel } from '@/lib/pricing'
import { profiles } from '@/lib/db/schema'
import { recordAiCall } from '@/lib/ai-guard'

interface FeatureRequestedEventData {
  jobId: string
  featureId: string        // PRDFeature.id or 'e2e'
  agentType: FeatureAgentType
  featureSlug: string
}

export const generateTestsAgent = inngest.createFunction(
  {
    id: 'generate-tests-agent',
    retries: 2,
    concurrency: [
      { limit: 20 },
      { limit: 5, key: 'event.data.jobId' },
    ],
    triggers: [{ event: 'generation/feature.requested' }],
  },
  async ({ event, step, logger }) => {
    const { jobId, featureId, agentType, featureSlug } = event.data as FeatureRequestedEventData
    const completionKey = `${featureId}:${agentType}`

    // 1. Load job row
    const job = await step.run('load-job', async () => {
      const [row] = await db.select().from(generationJobs).where(eq(generationJobs.id, jobId))
      if (!row) throw new Error(`generation job ${jobId} not found`)
      return row
    })

    // 2. Idempotency guard — use featureId:agentType as the completion key
    const alreadyCompleted = (job.agentsCompleted ?? []).includes(completionKey)
    if (alreadyCompleted) {
      logger.info({ jobId, featureId, agentType }, 'feature agent already completed — no-op')
      await step.sendEvent('feature-done-noop', {
        name: 'generation/feature.completed',
        data: { jobId, featureId, agentType, ok: true, deduped: true },
      })
      return { jobId, featureId, agentType, ok: true, deduped: true }
    }

    // 3. Run the feature agent
    const runResult = await step.run(`feature-${featureSlug}-${agentType}`, async () => {
      const t0 = Date.now()
      try {
        // Pre-flight balance check
        const [profile] = await db
          .select({ tokensRemaining: profiles.tokensRemaining })
          .from(profiles)
          .where(eq(profiles.id, job.userId))
        if ((profile?.tokensRemaining ?? 0) <= 0) {
          return {
            ok: false as const,
            errorCode: 'CREDITS_EXHAUSTED',
            message: 'Out of credits — feature agent skipped.',
            durationMs: Date.now() - t0,
          }
        }

        const payload = job.payload as GenerateTestsParams
        const agentTelemetry: AgentRunRecord[] = []
        const generationAbort = new AbortController()

        // For the e2e agent, extract the feature manifest from the job result
        let featureManifest: FeatureManifest[] | undefined
        if (agentType === 'e2e') {
          const result = (job.result || {}) as Record<string, unknown>
          featureManifest = Array.isArray(result.featureManifest)
            ? (result.featureManifest as FeatureManifest[])
            : []
        }

        const dispatchResult = await dispatchFeature({
          ...payload,
          agentType,
          featureId: featureId === 'e2e' ? null : featureId,
          featureManifest,
          abortSignal: generationAbort.signal,
          generatorConfig: {
            apiKey: process.env.OPENAI_API_KEY,
            timeout: 540_000,
          },
          onAgentComplete: async (record) => {
            agentTelemetry.push(record)
            if (record.success && (record.tokensTotal ?? 0) > 0) {
              const usage = await recordTokenUsage({
                userId: job.userId,
                endpoint: '/api/generate-tests',
                agent: record.agent,
                model: resolveModel(record.modelUsed),
                tokensInput: record.tokensPrompt ?? 0,
                tokensOutput: record.tokensCompletion ?? 0,
                referenceType: 'test_run',
                referenceId: job.testRunId ?? null,
              })
              if (usage && usage.balanceAfter <= 0 && !generationAbort.signal.aborted) {
                generationAbort.abort(new Error('CREDITS_EXHAUSTED'))
              }
            }
            await recordAiCall({
              userId: job.userId,
              apiKeyId: job.apiKeyId ?? '',
              endpoint: '/api/generate-tests',
              agent: record.agent,
              latencyMs: record.latencyMs,
              modelUsed: resolveModel(record.modelUsed),
              tokensPrompt: record.tokensPrompt,
              tokensCompletion: record.tokensCompletion,
              tokensTotal: record.tokensTotal,
              success: record.success,
              errorCode: record.errorCode ?? null,
            })
          },
        })

        return {
          ok: true as const,
          files: dispatchResult.files ?? [],
          generationMeta: dispatchResult.summary?.generationMeta ?? null,
          durationMs: Date.now() - t0,
        }
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string }
        return {
          ok: false as const,
          errorCode: e?.code || 'AGENT_FAILED',
          message: e?.message ?? String(err),
          durationMs: Date.now() - t0,
        }
      }
    })

    // 4. Persist result atomically
    await step.run('persist-feature-result', async () => {
      if (runResult.ok) {
        const filesJson = JSON.stringify(runResult.files)
        await db.execute(sql`
          UPDATE generation_jobs
          SET
            result = jsonb_set(
              COALESCE(result, '{}'::jsonb),
              '{tests}',
              COALESCE(result->'tests', '[]'::jsonb) || ${filesJson}::jsonb
            ),
            agents_completed = CASE
              WHEN ${completionKey} = ANY(agents_completed) THEN agents_completed
              ELSE array_append(agents_completed, ${completionKey})
            END,
            started_at = COALESCE(started_at, now())
          WHERE id = ${jobId}
        `)
      } else {
        const errorsJson = JSON.stringify([{ featureId, agentType, code: runResult.errorCode, message: runResult.message }])
        await db.execute(sql`
          UPDATE generation_jobs
          SET
            result = jsonb_set(
              COALESCE(result, '{}'::jsonb),
              '{errors}',
              COALESCE(result->'errors', '[]'::jsonb) || ${errorsJson}::jsonb
            ),
            agents_completed = CASE
              WHEN ${completionKey} = ANY(agents_completed) THEN agents_completed
              ELSE array_append(agents_completed, ${completionKey})
            END,
            started_at = COALESCE(started_at, now())
          WHERE id = ${jobId}
        `)
      }
    })

    // 5. Notify orchestrator
    await step.sendEvent('feature-done', {
      name: 'generation/feature.completed',
      data: { jobId, featureId, agentType, ok: runResult.ok, errorCode: runResult.ok ? undefined : runResult.errorCode },
    })

    logger.info({ jobId, featureId, agentType, ok: runResult.ok, durationMs: runResult.durationMs }, 'feature agent completed')
    return { jobId, featureId, agentType, ok: runResult.ok }
  }
)
