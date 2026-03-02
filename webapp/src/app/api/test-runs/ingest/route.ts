import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiKeys, testRuns, profiles } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { hashApiKey } from '@/lib/utils/api-keys'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { api_key, creation_name, report } = body

    if (!api_key || !report) {
      return NextResponse.json(
        { error: 'Missing required fields: api_key and report are required' },
        { status: 400 }
      )
    }

    const keyHash = hashApiKey(api_key)

    // Look up API key
    const [apiKeyRecord] = await db
      .select({ id: apiKeys.id, userId: apiKeys.userId, isActive: apiKeys.isActive })
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)))
      .limit(1)

    if (!apiKeyRecord) {
      return NextResponse.json({ error: 'Invalid or inactive API key' }, { status: 401 })
    }

    const userId = apiKeyRecord.userId

    // Extract stats from the report
    const stats = report.stats || {}
    const total_tests = stats.total || 0
    const passed_tests = stats.passed || 0
    const failed_tests = stats.failed || 0
    const skipped_tests = stats.skipped || 0
    const duration_ms = stats.duration || 0

    // Determine status
    let status: string
    if (failed_tests === 0 && total_tests > 0) {
      status = 'passed'
    } else if (failed_tests > 0) {
      status = 'failed'
    } else {
      status = 'error'
    }

    // Calculate backend and frontend pass rates
    const tests: Array<{ suite?: string; status?: string }> = report.tests || []
    const backendKeywords = ['api', 'backend', 'server']
    const isBackendTest = (test: { suite?: string }) =>
      backendKeywords.some(kw => (test.suite || '').toLowerCase().includes(kw))

    const backendTests = tests.filter(isBackendTest)
    const frontendTests = tests.filter(t => !isBackendTest(t))
    const backendPassed = backendTests.filter(t => t.status === 'passed').length
    const frontendPassed = frontendTests.filter(t => t.status === 'passed').length

    const backend_pass_rate = backendTests.length > 0
      ? Math.round((backendPassed / backendTests.length) * 100).toString()
      : null
    const frontend_pass_rate = frontendTests.length > 0
      ? Math.round((frontendPassed / frontendTests.length) * 100).toString()
      : null

    const projectName = creation_name || report.metadata?.projectName || 'Untitled Test Run'

    // Insert test run
    const [testRun] = await db
      .insert(testRuns)
      .values({
        userId,
        creationName: projectName,
        status,
        totalTests: total_tests,
        passedTests: passed_tests,
        failedTests: failed_tests,
        skippedTests: skipped_tests,
        durationMs: duration_ms,
        backendPassRate: backend_pass_rate,
        frontendPassRate: frontend_pass_rate,
        reportJson: report,
        aiAnalysis: report.aiSummary ?? null,
        source: 'mcp',
      })
      .returning({ id: testRuns.id })

    // Update last_used_at on the API key
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, apiKeyRecord.id))

    // Deduct 1 credit
    try {
      const [profile] = await db
        .select({ creditsRemaining: profiles.creditsRemaining })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1)

      if (profile && typeof profile.creditsRemaining === 'number') {
        await db
          .update(profiles)
          .set({ creditsRemaining: Math.max(0, profile.creditsRemaining - 1) })
          .where(eq(profiles.id, userId))
      }
    } catch (creditError) {
      console.warn('[Ingest] Failed to deduct credit:', creditError)
    }

    return NextResponse.json({
      success: true,
      test_run_id: testRun.id,
      dashboard_url: '/all-tests',
    })
  } catch (error) {
    console.error('[Ingest] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
