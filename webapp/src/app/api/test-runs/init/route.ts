import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiKeys, testRuns } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { hashApiKey } from '@/lib/utils/api-keys'
import { logBlockedRequest } from '@/lib/security-logger'

const ENDPOINT = '/api/test-runs/init'

/**
 * POST /api/test-runs/init
 *
 * Called by the MCP worker at the very start of a pipeline run to create an
 * in-progress test_runs row. Returns the DB UUID so subsequent PATCH calls
 * (heartbeat, findings, phase, complete) can target it by id.
 *
 * Auth: x-api-key header (same pattern as /api/test-runs/ingest).
 */
export async function POST(request: NextRequest) {
  try {
    const rawKey = request.headers.get('x-api-key') ?? null
    const body = await request.json()
    const finalApiKey: string = rawKey ?? body.api_key ?? ''

    if (!finalApiKey) {
      logBlockedRequest({ type: 'MISSING_API_KEY', reason: 'No x-api-key header or api_key body field', endpoint: ENDPOINT })
      return NextResponse.json({ error: 'Missing api_key' }, { status: 401 })
    }

    const keyHash = hashApiKey(finalApiKey)
    const [keyRecord] = await db
      .select({ id: apiKeys.id, userId: apiKeys.userId, revoked: apiKeys.revoked, expiresAt: apiKeys.expiresAt })
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)))
      .limit(1)

    if (!keyRecord || keyRecord.revoked) {
      logBlockedRequest({ type: 'INVALID_API_KEY', reason: 'Key not found, inactive, or revoked', endpoint: ENDPOINT })
      return NextResponse.json({ error: 'Invalid or revoked API key' }, { status: 401 })
    }

    if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
      return NextResponse.json({ error: 'API key has expired' }, { status: 401 })
    }

    const creationName = typeof body.creation_name === 'string' ? body.creation_name.slice(0, 200) : 'Untitled Test Run'
    const framework = typeof body.framework === 'string' ? body.framework : null
    const projectPath = typeof body.project_path === 'string' ? body.project_path : null

    const now = new Date()
    const [row] = await db
      .insert(testRuns)
      .values({
        userId: keyRecord.userId,
        creationName,
        status: 'in_progress',
        framework,
        projectPath,
        source: 'mcp',
        lastHeartbeatAt: now,
        currentPhase: 'started',
        currentPhaseAt: now,
      })
      .returning({ id: testRuns.id })

    return NextResponse.json({ test_run_id: row.id })
  } catch (error) {
    console.error('[test-runs/init] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
