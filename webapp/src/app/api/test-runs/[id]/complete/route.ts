import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiKeys, testRuns } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { hashApiKey } from '@/lib/utils/api-keys'
import { logBlockedRequest } from '@/lib/security-logger'

const ENDPOINT = '/api/test-runs/[id]/complete'

const ALLOWED_STATUSES = new Set(['completed', 'completed_partial', 'error', 'passed', 'failed'])

type TierCounts = { passed?: number; failed?: number; blocked?: number; skipped?: number; total?: number }

function normalizeTierResults(input: unknown): Record<string, TierCounts> | null {
  if (!input || typeof input !== 'object') return null
  const out: Record<string, TierCounts> = {}
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue
    const b = raw as Record<string, unknown>
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
    out[String(key).slice(0, 64)] = {
      passed: num(b.passed), failed: num(b.failed),
      blocked: num(b.blocked), skipped: num(b.skipped), total: num(b.total),
    }
  }
  return Object.keys(out).length > 0 ? out : null
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: runId } = await params
    const rawKey = request.headers.get('x-api-key') ?? null
    const body = await request.json()
    const { api_key, status, final_data } = body as {
      api_key?: string
      status?: string
      final_data?: {
        report?: { stats?: { total?: number; passed?: number; failed?: number; skipped?: number; duration?: number }; [key: string]: unknown }
        tier_results?: unknown
        pipeline_error?: unknown
      }
    }
    const finalApiKey = rawKey ?? api_key ?? ''

    if (!finalApiKey) {
      logBlockedRequest({ type: 'MISSING_API_KEY', reason: 'No x-api-key header', endpoint: ENDPOINT })
      return NextResponse.json({ error: 'Missing api_key' }, { status: 401 })
    }

    const resolvedStatus = typeof status === 'string' && ALLOWED_STATUSES.has(status) ? status : 'completed_partial'

    const keyHash = hashApiKey(finalApiKey)
    const [keyRecord] = await db
      .select({ id: apiKeys.id, userId: apiKeys.userId, revoked: apiKeys.revoked })
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)))
      .limit(1)

    if (!keyRecord || keyRecord.revoked) {
      return NextResponse.json({ error: 'Invalid or revoked API key' }, { status: 401 })
    }

    const userId = keyRecord.userId
    const now = new Date()

    const [run] = await db
      .select({ id: testRuns.id })
      .from(testRuns)
      .where(and(eq(testRuns.id, runId), eq(testRuns.userId, userId)))
      .limit(1)

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    // Build the update payload, optionally merging final stats from the report
    const patch: Partial<typeof testRuns.$inferInsert> & Record<string, unknown> = {
      status: resolvedStatus,
      currentPhase: 'completed',
      currentPhaseAt: now,
      updatedAt: now,
    }

    if (final_data?.report) {
      const stats = final_data.report.stats ?? {}
      const intOrUndef = (v: unknown) =>
        typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : undefined
      const total = intOrUndef(stats.total)
      const passed = intOrUndef(stats.passed)
      const failed = intOrUndef(stats.failed)
      const skipped = intOrUndef(stats.skipped)
      const duration = intOrUndef(stats.duration)
      if (total !== undefined) patch.totalTests = total
      if (passed !== undefined) patch.passedTests = passed
      if (failed !== undefined) patch.failedTests = failed
      if (skipped !== undefined) patch.skippedTests = skipped
      if (duration !== undefined) patch.durationMs = duration
      patch.reportJson = final_data.report
    }

    const normalizedTier = normalizeTierResults(final_data?.tier_results)
    if (normalizedTier) patch.tierResults = normalizedTier

    if (final_data?.pipeline_error && typeof final_data.pipeline_error === 'object') {
      patch.pipelineError = final_data.pipeline_error as Record<string, unknown>
    }

    await db
      .update(testRuns)
      .set(patch)
      .where(and(eq(testRuns.id, runId), eq(testRuns.userId, userId)))

    return NextResponse.json({ ok: true, status: resolvedStatus })
  } catch (error) {
    console.error('[test-runs/[id]/complete] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
