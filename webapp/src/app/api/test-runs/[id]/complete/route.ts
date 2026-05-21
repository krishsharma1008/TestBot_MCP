import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiKeys, testRuns } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { hashApiKey } from '@/lib/utils/api-keys'

const ALLOWED_FINAL_STATUSES = new Set([
  'passed',
  'failed',
  'error',
  'completed_with_findings',
  'completed_partial',
])

/**
 * PATCH /api/test-runs/:id/complete
 *
 * Finalizes an in-progress run. Sets the terminal status (passed, failed,
 * error, completed_with_findings, completed_partial). The existing ingest
 * endpoint still creates a full run row on success; this endpoint handles
 * partial-completion when the run is killed mid-way or finishes without all
 * tiers completing.
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
      status?: string
      current_phase?: string
      total_tests?: number
      passed_tests?: number
      failed_tests?: number
      skipped_tests?: number
      duration_ms?: number
    }
    const finalApiKey: string = rawKey ?? body.api_key ?? ''

    if (!finalApiKey) {
      return NextResponse.json({ error: 'Missing api_key' }, { status: 401 })
    }

    const status = typeof body.status === 'string' ? body.status : 'completed_partial'
    if (!ALLOWED_FINAL_STATUSES.has(status)) {
      return NextResponse.json({ error: `Invalid status. Allowed: ${[...ALLOWED_FINAL_STATUSES].join(', ')}` }, { status: 400 })
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

    const now = new Date()
    const updates: Record<string, unknown> = {
      status,
      updatedAt: now,
    }
    if (typeof body.current_phase === 'string') {
      updates.currentPhase = body.current_phase.slice(0, 120)
      updates.currentPhaseAt = now
    }
    if (typeof body.total_tests === 'number') updates.totalTests = body.total_tests
    if (typeof body.passed_tests === 'number') updates.passedTests = body.passed_tests
    if (typeof body.failed_tests === 'number') updates.failedTests = body.failed_tests
    if (typeof body.skipped_tests === 'number') updates.skippedTests = body.skipped_tests
    if (typeof body.duration_ms === 'number') updates.durationMs = body.duration_ms

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await db
      .update(testRuns)
      .set(updates as any)
      .where(and(eq(testRuns.id, id), eq(testRuns.userId, keyRecord.userId)))
      .returning({ id: testRuns.id })

    if (result.length === 0) {
      return NextResponse.json({ error: 'Test run not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, test_run_id: id })
  } catch (error) {
    console.error('[test-runs/complete] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
