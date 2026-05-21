import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiKeys, testRuns } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { hashApiKey } from '@/lib/utils/api-keys'
import { logBlockedRequest } from '@/lib/security-logger'

const ENDPOINT = '/api/test-runs/[id]/findings'

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
    const { api_key, findings, tier_results, phase } = body as {
      api_key?: string
      findings?: unknown[]
      tier_results?: unknown
      phase?: string
    }
    const finalApiKey = rawKey ?? api_key ?? ''

    if (!finalApiKey) {
      logBlockedRequest({ type: 'MISSING_API_KEY', reason: 'No x-api-key header', endpoint: ENDPOINT })
      return NextResponse.json({ error: 'Missing api_key' }, { status: 401 })
    }

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

    // Fetch current partialFindings to append into
    const [run] = await db
      .select({ id: testRuns.id, partialFindings: testRuns.partialFindings })
      .from(testRuns)
      .where(and(eq(testRuns.id, runId), eq(testRuns.userId, userId)))
      .limit(1)

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    const incomingFindings = Array.isArray(findings) ? findings : []
    const existing = Array.isArray(run.partialFindings) ? (run.partialFindings as unknown[]) : []
    const merged = [...existing, ...incomingFindings]

    const normalizedTier = normalizeTierResults(tier_results)
    const cleanPhase = typeof phase === 'string' && phase ? phase.slice(0, 120) : null

    await db
      .update(testRuns)
      .set({
        partialFindings: merged,
        ...(normalizedTier ? { tierResults: normalizedTier } : {}),
        ...(cleanPhase ? { currentPhase: cleanPhase, currentPhaseAt: now } : {}),
        updatedAt: now,
      })
      .where(and(eq(testRuns.id, runId), eq(testRuns.userId, userId)))

    return NextResponse.json({ ok: true, finding_count: merged.length })
  } catch (error) {
    console.error('[test-runs/[id]/findings] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
