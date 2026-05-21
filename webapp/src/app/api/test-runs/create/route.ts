import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiKeys, testRuns } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { hashApiKey } from '@/lib/utils/api-keys'
import { logBlockedRequest } from '@/lib/security-logger'

const ENDPOINT = '/api/test-runs/create'

export async function POST(request: NextRequest) {
  try {
    const rawKey = request.headers.get('x-api-key') ?? null
    const body = await request.json()
    const { api_key, run_id, creation_name, project_path } = body as {
      api_key?: string
      run_id?: string
      creation_name?: string
      project_path?: string
    }
    const finalApiKey = rawKey ?? api_key ?? ''

    if (!finalApiKey) {
      logBlockedRequest({ type: 'MISSING_API_KEY', reason: 'No x-api-key header', endpoint: ENDPOINT })
      return NextResponse.json({ error: 'Missing api_key' }, { status: 401 })
    }
    if (!run_id || typeof run_id !== 'string') {
      return NextResponse.json({ error: 'Missing required field: run_id' }, { status: 400 })
    }

    const keyHash = hashApiKey(finalApiKey)
    const [keyRecord] = await db
      .select({ id: apiKeys.id, userId: apiKeys.userId, revoked: apiKeys.revoked, expiresAt: apiKeys.expiresAt })
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)))
      .limit(1)

    if (!keyRecord || keyRecord.revoked) {
      return NextResponse.json({ error: 'Invalid or revoked API key' }, { status: 401 })
    }
    if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
      return NextResponse.json({ error: 'API key has expired' }, { status: 401 })
    }

    const userId = keyRecord.userId
    const now = new Date()

    // Idempotent: if the run row already exists for this user, return it as-is.
    const [existing] = await db
      .select({ id: testRuns.id })
      .from(testRuns)
      .where(and(eq(testRuns.id, run_id), eq(testRuns.userId, userId)))
      .limit(1)

    if (existing) {
      return NextResponse.json({
        success: true,
        test_run_id: existing.id,
        dashboard_url: `/test-run/${existing.id}`,
      })
    }

    await db.insert(testRuns).values({
      id: run_id,
      userId,
      creationName: (typeof creation_name === 'string' && creation_name.trim()) ? creation_name.trim() : 'Unnamed run',
      status: 'running',
      projectPath: typeof project_path === 'string' ? project_path : null,
      lastHeartbeatAt: now,
      currentPhase: 'started',
      currentPhaseAt: now,
      createdAt: now,
      updatedAt: now,
    })

    return NextResponse.json({
      success: true,
      test_run_id: run_id,
      dashboard_url: `/test-run/${run_id}`,
    })
  } catch (error) {
    console.error('[test-runs/create] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
