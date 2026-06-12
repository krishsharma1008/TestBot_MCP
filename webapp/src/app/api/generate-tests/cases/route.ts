import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiKeys } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { hashApiKey } from '@/lib/utils/api-keys'
import { planFeatureTestCases } from '@/lib/test-generation/scenario-planner'
import { checkRateLimit } from '@/lib/rate-limit'
import { checkAiGuard, recordAiCall } from '@/lib/ai-guard'
import { checkTokenBalance, recordTokenUsage, MIN_TOKENS_GENERATE, REC_TOKENS_GENERATE } from '@/lib/tokens'
import { resolveModel } from '@/lib/pricing'
import { logBlockedRequest } from '@/lib/security-logger'
import type {
  PRDFeature,
  ExplorationArtifact,
  CapturedContext,
  ProjectInfo,
} from '@/lib/test-generation/types'

const ENDPOINT = '/api/generate-tests/cases'

export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'Server OpenAI key not configured' }, { status: 503 })
    }

    const rawKey = request.headers.get('x-api-key') ?? null
    const body = await request.json()
    const api_key: string = rawKey ?? body?.api_key ?? ''

    if (!api_key) {
      logBlockedRequest({ type: 'MISSING_API_KEY', reason: 'No x-api-key header or api_key body field', endpoint: ENDPOINT })
      return NextResponse.json({ error: 'Missing api_key' }, { status: 401 })
    }

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
      logBlockedRequest({ type: 'REVOKED_API_KEY', user_id: apiKeyRecord.userId, reason: 'Key revoked', endpoint: ENDPOINT })
      return NextResponse.json({ error: 'API key has been revoked' }, { status: 401 })
    }
    if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
      logBlockedRequest({ type: 'EXPIRED_API_KEY', user_id: apiKeyRecord.userId, reason: 'Key expired', endpoint: ENDPOINT })
      return NextResponse.json({ error: 'API key has expired' }, { status: 401 })
    }

    const userId = apiKeyRecord.userId

    const rateResult = await checkRateLimit({ keyHash, userId, endpoint: ENDPOINT })
    if (!rateResult.allowed) {
      return NextResponse.json({ error: 'RATE_LIMIT_EXCEEDED' }, { status: 429, headers: { 'Retry-After': String(rateResult.retryAfter ?? 1) } })
    }

    const aiGuardResult = await checkAiGuard({ userId, endpoint: ENDPOINT })
    if (!aiGuardResult.allowed) {
      return NextResponse.json({ error: 'RATE_LIMIT_EXCEEDED' }, { status: 429 })
    }

    const tokenCheck = await checkTokenBalance({ userId, endpoint: ENDPOINT, minRequired: MIN_TOKENS_GENERATE, recommended: REC_TOKENS_GENERATE })
    if (!tokenCheck.allowed) {
      return NextResponse.json({ error: tokenCheck.reason }, { status: 402 })
    }

    const feature = (body as { feature?: unknown }).feature as PRDFeature | undefined
    if (!feature?.id || !feature?.name || !Array.isArray(feature?.userStories)) {
      return NextResponse.json({ error: 'Missing or invalid feature in request body' }, { status: 422 })
    }

    const explorationArtifact = ((body as { explorationArtifact?: unknown }).explorationArtifact ?? null) as ExplorationArtifact | null
    const context = ((body as { context?: unknown }).context ?? null) as CapturedContext | null
    const testType = (['frontend', 'backend', 'both'].includes((body as { testType?: unknown }).testType as string)
      ? (body as { testType: string }).testType
      : 'both') as 'frontend' | 'backend' | 'both'
    const prd = typeof (body as { prd?: unknown }).prd === 'string' ? (body as { prd: string }).prd : undefined
    const projectInfo = ((body as { projectInfo?: unknown }).projectInfo ?? {}) as ProjectInfo

    const t0 = Date.now()
    const plan = await planFeatureTestCases(
      { feature, explorationArtifact, context, testType, prd, projectInfo },
      process.env.OPENAI_API_KEY
    )
    const latencyMs = Date.now() - t0

    // Token accounting — use the real usage returned by the planner LLM call.
    // Fall back to a small floor when usage is unavailable (e.g. the LLM call
    // threw and we returned an empty plan) so accounting never records zero/NaN.
    const tokensInput = plan.usage.promptTokens > 0 ? plan.usage.promptTokens : 800
    const tokensOutput = plan.usage.completionTokens > 0 ? plan.usage.completionTokens : 300
    const tokensTotal = plan.usage.totalTokens > 0 ? plan.usage.totalTokens : tokensInput + tokensOutput
    await recordTokenUsage({
      userId,
      endpoint: ENDPOINT,
      agent: 'scenario-planner',
      model: resolveModel(null),
      tokensInput,
      tokensOutput,
      referenceType: 'test_run',
      referenceId: request.headers.get('x-healix-run-id') ?? null,
    }).catch(() => {})

    await recordAiCall({
      userId,
      apiKeyId: apiKeyRecord.id,
      endpoint: ENDPOINT,
      agent: 'scenario-planner',
      latencyMs,
      modelUsed: resolveModel(null),
      tokensPrompt: tokensInput,
      tokensCompletion: tokensOutput,
      tokensTotal,
      success: true,
      errorCode: null,
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      featureId: plan.featureId,
      specs: plan.specs,
    })
  } catch (error) {
    console.error('[generate-tests/cases] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
