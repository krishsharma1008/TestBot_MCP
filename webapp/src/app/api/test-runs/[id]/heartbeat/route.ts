import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { testRuns } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

/**
 * POST /api/test-runs/[id]/heartbeat
 * Worker health monitoring endpoint
 * Updates last_heartbeat_at timestamp to indicate worker is still active
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    // Verify the test run belongs to the user
    const [run] = await db
      .select()
      .from(testRuns)
      .where(and(eq(testRuns.id, id), eq(testRuns.userId, user.id)))
      .limit(1)

    if (!run) {
      return NextResponse.json({ error: 'Test run not found' }, { status: 404 })
    }

    // Update last_heartbeat_at timestamp
    await db
      .update(testRuns)
      .set({ lastHeartbeatAt: new Date() })
      .where(eq(testRuns.id, id))

    return NextResponse.json({ success: true, lastHeartbeatAt: new Date().toISOString() })
  } catch (error) {
    console.error('[POST /api/test-runs/[id]/heartbeat] Error:', error)
    return NextResponse.json({ error: 'Failed to update heartbeat' }, { status: 500 })
  }
}
