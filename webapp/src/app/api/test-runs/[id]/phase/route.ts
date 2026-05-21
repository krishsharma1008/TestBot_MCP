import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiKeys, testRuns } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { hashApiKey } from '@/lib/utils/api-keys'

/**
 * PATCH /api/test-runs/:id/phase
 *
 * Updates current_phase on a specific test run row (by DB UUID).
 * Also bumps last_heartbeat_at so a phase update doubles as a keep-alive.
 *
 * Distinct from POST /api/test-runs/phase which writes to mcpTelemetryEvents
 * and resolves runs by MCP run_id rather than DB UUID.
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
      phase?: string
    }
    const finalApiKey: string = rawKey ?? body.api_key ?? ''

    if (!finalApiKey) {
      return NextResponse.json({ error: 'Missing api_key' }, { status: 401 })
    }

    const phase = typeof body.phase === 'string' ? body.phase.slice(0, 120) : null
    if (!phase) {
      return NextResponse.json({ error: 'Missing required field: phase' }, { status: 400 })
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
    const result = await db
      .update(testRuns)
      .set({ currentPhase: phase, currentPhaseAt: now, lastHeartbeatAt: now, updatedAt: now })
      .where(and(eq(testRuns.id, id), eq(testRuns.userId, keyRecord.userId)))
      .returning({ id: testRuns.id })

    if (result.length === 0) {
      return NextResponse.json({ error: 'Test run not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[test-runs/[id]/phase] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
