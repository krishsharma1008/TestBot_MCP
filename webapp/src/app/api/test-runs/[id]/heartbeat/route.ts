import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiKeys, testRuns } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { hashApiKey } from '@/lib/utils/api-keys'
import { logBlockedRequest } from '@/lib/security-logger'

const ENDPOINT = '/api/test-runs/[id]/heartbeat'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: runId } = await params
    const rawKey = request.headers.get('x-api-key') ?? null
    const body = await request.json()
    const { api_key, phase } = body as { api_key?: string; phase?: string }
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
    const cleanPhase = typeof phase === 'string' && phase ? phase.slice(0, 120) : null

    await db
      .update(testRuns)
      .set({
        lastHeartbeatAt: now,
        ...(cleanPhase ? { currentPhase: cleanPhase, currentPhaseAt: now } : {}),
        updatedAt: now,
      })
      .where(and(eq(testRuns.id, runId), eq(testRuns.userId, userId)))

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[test-runs/[id]/heartbeat] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
