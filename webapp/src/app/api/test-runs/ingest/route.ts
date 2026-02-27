import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashApiKey } from '@/lib/utils/api-keys'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { api_key, creation_name, report } = body

    // Validate required fields
    if (!api_key || !report) {
      return NextResponse.json(
        { error: 'Missing required fields: api_key and report are required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Hash the API key and look it up in the api_keys table
    const keyHash = hashApiKey(api_key)

    const { data: apiKeyRecord, error: apiKeyError } = await supabase
      .from('api_keys')
      .select('id, user_id, is_active')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single()

    if (apiKeyError || !apiKeyRecord) {
      return NextResponse.json(
        { error: 'Invalid or inactive API key' },
        { status: 401 }
      )
    }

    const userId = apiKeyRecord.user_id

    // Extract stats from the report
    const stats = report.stats || {}
    const total_tests = stats.total || 0
    const passed_tests = stats.passed || 0
    const failed_tests = stats.failed || 0
    const skipped_tests = stats.skipped || 0
    const duration_ms = stats.duration || 0
    const pass_rate = total_tests > 0 ? Math.round((passed_tests / total_tests) * 100) : 0

    // Determine status
    let status: string
    if (failed_tests === 0 && total_tests > 0) {
      status = 'passed'
    } else if (failed_tests > 0) {
      status = 'failed'
    } else {
      status = 'error'
    }

    // Calculate backend and frontend pass rates from tests array
    const tests: Array<{ suite?: string; status?: string }> = report.tests || []

    const backendKeywords = ['api', 'backend', 'server']
    const isBackendTest = (test: { suite?: string }) =>
      backendKeywords.some(kw =>
        (test.suite || '').toLowerCase().includes(kw)
      )

    const backendTests = tests.filter(isBackendTest)
    const frontendTests = tests.filter(t => !isBackendTest(t))

    const backendPassed = backendTests.filter(t => t.status === 'passed').length
    const frontendPassed = frontendTests.filter(t => t.status === 'passed').length

    const backend_pass_rate =
      backendTests.length > 0
        ? Math.round((backendPassed / backendTests.length) * 100)
        : null

    const frontend_pass_rate =
      frontendTests.length > 0
        ? Math.round((frontendPassed / frontendTests.length) * 100)
        : null

    // Insert into test_runs table
    const projectName =
      creation_name ||
      report.metadata?.projectName ||
      'Untitled Test Run'

    const { data: testRun, error: insertError } = await supabase
      .from('test_runs')
      .insert({
        user_id: userId,
        creation_name: projectName,
        status,
        total_tests,
        passed_tests,
        failed_tests,
        skipped_tests,
        duration_ms,
        backend_pass_rate,
        frontend_pass_rate,
        report_json: report,
        ai_analysis: report.aiSummary ?? null,
        source: 'mcp',
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[Ingest] Failed to insert test run:', insertError)
      return NextResponse.json(
        { error: 'Failed to save test run', details: insertError.message },
        { status: 500 }
      )
    }

    // Update last_used_at on the API key
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', apiKeyRecord.id)

    // Deduct 1 credit from the user's credits_remaining in profiles
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('credits_remaining')
        .eq('id', userId)
        .single()

      if (profile && typeof profile.credits_remaining === 'number') {
        await supabase
          .from('profiles')
          .update({ credits_remaining: Math.max(0, profile.credits_remaining - 1) })
          .eq('id', userId)
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
