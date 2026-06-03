import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiKeys, generationJobs, profiles } from '@/lib/db/schema'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { hashApiKey } from '@/lib/utils/api-keys'
import { dispatchFeature } from '@/lib/test-generation/agent-dispatcher'
import { inngest } from '@/lib/inngest/client'
import type {
  CapturedContext,
  GenerationOptions,
  ProjectInfo,
  ParsedPRD,
  ExplorationArtifact,
  Role,
  AgentRunRecord,
  FeatureAgentType,
  FeatureManifest,
  TestCaseSpec,
} from '@/lib/test-generation/types'
import { checkRateLimit } from '@/lib/rate-limit'
import { checkTokenBalance, recordTokenUsage, MIN_TOKENS_GENERATE, REC_TOKENS_GENERATE } from '@/lib/tokens'
import { resolveModel } from '@/lib/pricing'
import { resolveConfiguredOpenAIModel } from '@/lib/model-defaults'
import { checkConcurrencyLimit } from '@/lib/concurrency-limit'
import { checkIdempotency, storeIdempotencyResult } from '@/lib/idempotency'
import { validateGenerateTests } from '@/lib/validation'
import { checkAiGuard, recordAiCall } from '@/lib/ai-guard'
import { runAbuseDetection } from '@/lib/abuse-detector'
import { logBlockedRequest } from '@/lib/security-logger'

const ENDPOINT = '/api/generate-tests'

export const maxDuration = 800

const KNOWN_AGENT_TYPES: readonly FeatureAgentType[] = ['auth', 'ui', 'api', 'e2e']

function normalizeAgentType(raw: unknown):
  | { ok: true; agentType: FeatureAgentType }
  | { ok: false; code: string } {
  if (raw === undefined || raw === null) return { ok: true, agentType: 'ui' }
  if (typeof raw !== 'string') return { ok: false, code: 'INVALID_AGENT_TYPE' }
  const cleaned = raw.trim().toLowerCase() as FeatureAgentType
  if (!KNOWN_AGENT_TYPES.includes(cleaned)) {
    return { ok: false, code: 'INVALID_AGENT_TYPE' }
  }
  return { ok: true, agentType: cleaned }
}

// ── Main POST handler ─────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    // 0. Validate server-side key exists
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'Server OpenAI key not configured' }, { status: 503 })
    }

    // 1. API key presence check (header or body)
    const rawKey = request.headers.get('x-api-key') ?? null
    const body = await request.json()
    const api_key: string = rawKey ?? body?.api_key ?? ''

    if (!api_key) {
      logBlockedRequest({ type: 'MISSING_API_KEY', reason: 'No x-api-key header or api_key body field', endpoint: ENDPOINT })
      return NextResponse.json({ error: 'Missing api_key' }, { status: 401 })
    }

    // 2. Authenticate
    const keyHash = hashApiKey(api_key)
    const [apiKeyRecord] = await db
      .select({ id: apiKeys.id, userId: apiKeys.userId, isActive: apiKeys.isActive, revoked: apiKeys.revoked, expiresAt: apiKeys.expiresAt })
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)))
      .limit(1)

    if (!apiKeyRecord) {
      logBlockedRequest({ type: 'INVALID_API_KEY', reason: 'Key not found or inactive', endpoint: ENDPOINT })
      return NextResponse.json({ error: 'Invalid or inactive API key' }, { status: 401 })
    }

    if (apiKeyRecord.revoked) {
      logBlockedRequest({ type: 'REVOKED_API_KEY', user_id: apiKeyRecord.userId, reason: 'API key has been revoked', endpoint: ENDPOINT })
      return NextResponse.json({ error: 'API key has been revoked' }, { status: 401 })
    }

    if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
      logBlockedRequest({ type: 'EXPIRED_API_KEY', user_id: apiKeyRecord.userId, reason: 'API key has expired', endpoint: ENDPOINT })
      return NextResponse.json({ error: 'API key has expired' }, { status: 401 })
    }

    const userId = apiKeyRecord.userId

    // 3. Rate limit
    const rateResult = await checkRateLimit({ keyHash, userId, endpoint: ENDPOINT })
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: 'RATE_LIMIT_EXCEEDED' },
        { status: 429, headers: { 'Retry-After': String(rateResult.retryAfter ?? 1) } }
      )
    }

    // 4. Concurrency limit
    const concurrencyResult = await checkConcurrencyLimit({ userId, endpoint: ENDPOINT })
    if (!concurrencyResult.allowed) {
      return NextResponse.json({ error: 'CONCURRENT_LIMIT_EXCEEDED' }, { status: 429 })
    }

    // 5. Idempotency
    const idempotencyKey = request.headers.get('x-idempotency-key')
    if (idempotencyKey) {
      const idempotencyResult = await checkIdempotency({ idempotencyKey, userId, endpoint: ENDPOINT })
      if (idempotencyResult.isDuplicate) {
        return NextResponse.json(idempotencyResult.cachedBody)
      }
    }

    // 6. Input validation
    const validationError = validateGenerateTests(body)
    if (validationError) {
      return NextResponse.json(validationError, { status: 422 })
    }

    // 6a. Validate agentType
    const agentTypeResult = normalizeAgentType((body as { agentType?: unknown }).agentType)
    if (!agentTypeResult.ok) {
      return NextResponse.json(
        { error: agentTypeResult.code, allowed: KNOWN_AGENT_TYPES },
        { status: 400 }
      )
    }
    const agentType = agentTypeResult.agentType

    // 6b. featureId — optional string, null for auth/e2e agents
    const featureId = typeof (body as { featureId?: unknown }).featureId === 'string'
      ? ((body as { featureId: string }).featureId || null)
      : null

    // 6c. featureManifest — passed to e2e agent only
    const featureManifest = Array.isArray((body as { featureManifest?: unknown }).featureManifest)
      ? ((body as { featureManifest: FeatureManifest[] }).featureManifest)
      : undefined

    // 6d. specs — pre-planned test cases from scenario planner (optional)
    const specs = Array.isArray((body as { specs?: unknown }).specs)
      ? ((body as { specs: TestCaseSpec[] }).specs)
      : undefined

    // 7. AI cost guard
    const aiGuardResult = await checkAiGuard({ userId, endpoint: ENDPOINT })
    if (!aiGuardResult.allowed) {
      return NextResponse.json({ error: 'RATE_LIMIT_EXCEEDED' }, { status: 429 })
    }

    // 8. Token balance gate
    const tokenCheck = await checkTokenBalance({ userId, endpoint: ENDPOINT, minRequired: MIN_TOKENS_GENERATE, recommended: REC_TOKENS_GENERATE })
    if (!tokenCheck.allowed) {
      return NextResponse.json({ error: tokenCheck.reason }, { status: 402 })
    }

    // Update last_used_at
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, apiKeyRecord.id))

    // ── Async path (Inngest) ──────────────────────────────────────────────────
    const asyncHeader = request.headers.get('x-healix-async')
    const asyncBodyFlag = (body as { async?: unknown })?.async === true
    let userOverrideEnabled = false
    try {
      const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1)
      userOverrideEnabled = Boolean(
        (profile as unknown as { settings?: { gen_async_enabled?: unknown } })?.settings?.gen_async_enabled
      )
    } catch { /* swallow */ }
    const flagEnabled = process.env.HEALIX_GEN_ASYNC === 'true' || userOverrideEnabled
    const wantAsync = (asyncHeader === '1' || asyncBodyFlag) && flagEnabled

    let fallbackToSync = false

    if (wantAsync) {
      const MAX_CONCURRENT_JOBS = 3
      const inFlight = await db
        .select({ count: sql<number>`count(*)` })
        .from(generationJobs)
        .where(and(eq(generationJobs.userId, userId), inArray(generationJobs.status, ['queued', 'running'])))
      const currentInFlight = Number(inFlight[0]?.count ?? 0)
      if (currentInFlight >= MAX_CONCURRENT_JOBS) {
        return NextResponse.json(
          { error: 'TOO_MANY_CONCURRENT_JOBS', message: `You have ${MAX_CONCURRENT_JOBS} generation jobs in flight.` },
          { status: 429 }
        )
      }

      // The async job stores the full payload; the Inngest orchestrator uses
      // agentType + featureId to drive the feature loop.
      const asyncIdemKey =
        request.headers.get('x-idempotency-key') ||
        (typeof (body as { idempotencyKey?: unknown })?.idempotencyKey === 'string'
          ? ((body as { idempotencyKey?: string }).idempotencyKey as string)
          : null)

      if (asyncIdemKey) {
        const [existing] = await db
          .select()
          .from(generationJobs)
          .where(and(eq(generationJobs.userId, userId), eq(generationJobs.idempotencyKey, asyncIdemKey)))
          .limit(1)
        if (existing) {
          return NextResponse.json(
            { jobId: existing.id, status: existing.status, pollUrl: `/api/generate-tests/jobs/${existing.id}` },
            { status: 202 }
          )
        }
      }

      const [inserted] = await db
        .insert(generationJobs)
        .values({
          userId,
          apiKeyId: apiKeyRecord.id,
          status: 'queued',
          payload: body as Record<string, unknown>,
          // Store the feature jobs requested so the orchestrator can fan out
          agentsRequested: featureId ? [`${agentType}:${featureId}`] : [agentType],
          idempotencyKey: asyncIdemKey,
        })
        .returning({ id: generationJobs.id })

      const jobId = inserted.id

      try {
        await inngest.send({ name: 'generation/job.requested', data: { jobId } })
      } catch (inngestErr) {
        const msg = inngestErr instanceof Error ? inngestErr.message : String(inngestErr)
        console.warn('[generate-tests] inngest.send failed, falling back to sync', { jobId, err: msg })
        await db.update(generationJobs)
          .set({ status: 'failed', completedAt: new Date(), error: { reason: 'inngest_send_failed', message: msg } })
          .where(eq(generationJobs.id, jobId))
          .catch(() => {})
        fallbackToSync = true
      }

      if (!fallbackToSync) {
        const responsePayload = { jobId, status: 'queued' as const, pollUrl: `/api/generate-tests/jobs/${jobId}` }
        if (asyncIdemKey) {
          await storeIdempotencyResult({ idempotencyKey: asyncIdemKey, userId, endpoint: ENDPOINT, responseBody: responsePayload })
        }
        return NextResponse.json(responsePayload, { status: 202 })
      }
    }

    // ── Sync path ─────────────────────────────────────────────────────────────
    const { context, testType, prd, parsedPRD, explorationArtifact, roles, projectInfo, options } = body

    const ctx = (context || {}) as CapturedContext
    const info = (projectInfo || {}) as ProjectInfo
    const type = (testType || 'both') as 'frontend' | 'backend' | 'both'
    const prdContent = (prd || '') as string
    const genOptions = (options || {}) as GenerationOptions
    const parsedPRDInput = (parsedPRD || null) as ParsedPRD | null
    const explorationInput = (explorationArtifact || null) as ExplorationArtifact | null
    const rolesInput = Array.isArray(roles) ? (roles as Role[]) : []

    const agentTelemetry: AgentRunRecord[] = []
    const runId = request.headers.get('x-healix-run-id') || null
    const generationAbort = new AbortController()

    const { files: generatedFiles, summary } = await dispatchFeature({
      context: ctx,
      prd: prdContent,
      parsedPRD: parsedPRDInput,
      explorationArtifact: explorationInput,
      roles: rolesInput,
      testType: type,
      projectInfo: info,
      options: genOptions,
      agentType,
      featureId,
      featureManifest,
      specs,
      abortSignal: generationAbort.signal,
      generatorConfig: {
        apiKey: process.env.OPENAI_API_KEY,
        model: resolveConfiguredOpenAIModel(),
        fallbackOnFailure: genOptions.strictAIGeneration !== true,
        enforceValidation: true,
        syntaxValidationMode: 'fail-open',
        strictAIGeneration: genOptions.strictAIGeneration === true,
        timeout: Number(process.env.HEALIX_OPENAI_TIMEOUT_MS) || 540_000,
      },
      onAgentComplete: async (record) => {
        agentTelemetry.push(record)
        if (record.success && (record.tokensTotal ?? 0) > 0) {
          const usage = await recordTokenUsage({
            userId,
            endpoint: ENDPOINT,
            agent: record.agent,
            model: resolveModel(record.modelUsed),
            tokensInput: record.tokensPrompt ?? 0,
            tokensOutput: record.tokensCompletion ?? 0,
            referenceType: 'test_run',
            referenceId: runId,
          })
          if (usage && usage.balanceAfter <= 0 && !generationAbort.signal.aborted) {
            generationAbort.abort(new Error('CREDITS_EXHAUSTED'))
          }
        }
        await recordAiCall({
          userId,
          apiKeyId: apiKeyRecord.id,
          endpoint: ENDPOINT,
          agent: record.agent,
          latencyMs: record.latencyMs,
          modelUsed: resolveModel(record.modelUsed),
          tokensPrompt: record.tokensPrompt,
          tokensCompletion: record.tokensCompletion,
          tokensTotal: record.tokensTotal,
          success: record.success,
          errorCode: record.errorCode ?? null,
          runId,
        })
      },
    })

    const responseBody = {
      success: true,
      tests: generatedFiles,
      count: generatedFiles.length,
      generationMeta: summary.generationMeta,
      byType: summary.byType,
      agentType,
      featureId,
      agentRuns: agentTelemetry,
    }

    if (idempotencyKey) {
      await storeIdempotencyResult({ idempotencyKey, userId, endpoint: ENDPOINT, responseBody })
    }

    runAbuseDetection({ userId, apiKeyId: apiKeyRecord.id }).catch((err: unknown) => {
      console.error('[generate-tests] abuse detection failed', err)
    })

    return NextResponse.json(responseBody)
  } catch (error) {
    console.error('[generate-tests] error:', error)
    const errCode = (error as NodeJS.ErrnoException).code
    const status =
      errCode === 'OPENAI_KEY_MISSING' ? 503
      : errCode === 'AI_GENERATION_INSUFFICIENT' || errCode === 'INSUFFICIENT_RUNNABLE_COVERAGE' || errCode === 'MIN_TEST_COUNT_NOT_MET' || errCode === 'COVERAGE_GATES_FAILED' ? 422
      : 500
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error', code: errCode || null },
      { status },
    )
  }
}
