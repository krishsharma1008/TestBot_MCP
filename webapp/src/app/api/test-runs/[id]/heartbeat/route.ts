import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiKeys, testRuns } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { hashApiKey } from '@/lib/utils/api-keys'

/**
 * PATCH /api/test-runs/:id/heartbeat
 *
 * Keep-alive signal from the MCP worker. Updates last_heartbeat_at so the
 * dashboard can detect stalled runs (no heartbeat for > 5 minutes).
 * Supabase Realtime broadcasts the UPDATE to all subscribed dashboard clients.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const rawKey = request.headers.get('x-api-key') ?? null
    const body = await request.json().catch(() => ({}))
    const finalApiKey: string = rawKey ?? (body as { api_key?: string }).api_key ?? ''

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

    const now = new Date()
    const result = await db
      .update(testRuns)
      .set({ lastHeartbeatAt: now, updatedAt: now })
      .where(and(eq(testRuns.id, id), eq(testRuns.userId, keyRecord.userId)))
      .returning({ id: testRuns.id })

    if (result.length === 0) {
      return NextResponse.json({ error: 'Test run not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[test-runs/heartbeat] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
