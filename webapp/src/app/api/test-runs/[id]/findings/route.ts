import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiKeys, testRuns } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { hashApiKey } from '@/lib/utils/api-keys'

type TierCounts = {
  passed?: number
  failed?: number
  blocked?: number
  skipped?: number
  total?: number
}

type TierResults = Record<string, TierCounts>

type FindingSummaryPartial = {
  total?: number
  realTotal?: number
  bySeverity?: Record<string, number>
  byStatus?: Record<string, number>
  byCategory?: Record<string, number>
  highestSeverity?: string | null
}

function normalizeTierCounts(raw: unknown): TierCounts {
  if (!raw || typeof raw !== 'object') return {}
  const b = raw as Record<string, unknown>
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  return {
    passed: n(b.passed),
    failed: n(b.failed),
    blocked: n(b.blocked),
    skipped: n(b.skipped),
    total: n(b.total),
  }
}

function mergeTierResults(existing: unknown, incoming: unknown): TierResults {
  const base: TierResults = existing && typeof existing === 'object' ? { ...(existing as TierResults) } : {}
  if (!incoming || typeof incoming !== 'object') return base
  for (const [key, raw] of Object.entries(incoming as Record<string, unknown>)) {
    base[String(key).slice(0, 64)] = normalizeTierCounts(raw)
  }
  return base
}

/**
 * PATCH /api/test-runs/:id/findings
 *
 * Streams partial findings to the dashboard as each tier completes.
 * Merges incoming tier_results into the existing row (deep merge by tier key)
 * and replaces finding_summary if provided.
 * Supabase Realtime broadcasts the UPDATE so the dashboard renders tier pills
 * and finding counts without polling.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const rawKey = request.headers.get('x-api-key') ?? null
    const body = await request.json().catch(() => ({})) as {
      api_key?: string
      tier_results?: unknown
      finding_summary?: unknown
      current_phase?: string
      total_tests?: number
      passed_tests?: number
      failed_tests?: number
      skipped_tests?: number
    }
    const finalApiKey: string = rawKey ?? body.api_key ?? ''

    if (!finalApiKey) {
      return NextResponse.json({ error: 'Missing api_key' }, { status: 401 })
    }

    const keyHash = hashApiKey(finalApiKey)
    const [keyRecord] = await db
      .select({ id: apiKeys.id, userId: apiKeys.userId })
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)))
      .limit(1)

    if (!keyRecord) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    // Load current tier_results so we can merge (not overwrite)
    const [existing] = await db
      .select({ tierResults: testRuns.tierResults })
      .from(testRuns)
      .where(and(eq(testRuns.id, id), eq(testRuns.userId, keyRecord.userId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Test run not found' }, { status: 404 })
    }

    const mergedTierResults = body.tier_results
      ? mergeTierResults(existing.tierResults, body.tier_results)
      : (existing.tierResults ?? null)

    const findingSummary = body.finding_summary && typeof body.finding_summary === 'object'
      ? body.finding_summary as FindingSummaryPartial
      : null

    const now = new Date()
    const updates: Record<string, unknown> = {
      tierResults: mergedTierResults,
      lastHeartbeatAt: now,
      updatedAt: now,
    }
    if (findingSummary) updates.findingSummary = findingSummary
    if (typeof body.current_phase === 'string') {
      updates.currentPhase = body.current_phase.slice(0, 120)
      updates.currentPhaseAt = now
    }
    if (typeof body.total_tests === 'number') updates.totalTests = body.total_tests
    if (typeof body.passed_tests === 'number') updates.passedTests = body.passed_tests
    if (typeof body.failed_tests === 'number') updates.failedTests = body.failed_tests
    if (typeof body.skipped_tests === 'number') updates.skippedTests = body.skipped_tests

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db
      .update(testRuns)
      .set(updates as any)
      .where(and(eq(testRuns.id, id), eq(testRuns.userId, keyRecord.userId)))

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[test-runs/findings] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
