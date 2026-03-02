import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { testRuns } from '@/lib/db/schema'
import { eq, and, desc, asc, count } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
  const sort_by = searchParams.get('sort_by') ?? 'created_at'
  const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc'
  const status = searchParams.get('status')

  const sortFieldMap: Record<string, any> = {
    created_at: testRuns.createdAt,
    updated_at: testRuns.updatedAt,
    status: testRuns.status,
    total_tests: testRuns.totalTests,
    duration_ms: testRuns.durationMs,
  }
  const sortField = sortFieldMap[sort_by] ?? testRuns.createdAt
  const orderFn = order === 'asc' ? asc : desc

  try {
    // Build where conditions
    const conditions = [eq(testRuns.userId, user.id)]
    if (status) conditions.push(eq(testRuns.status, status))
    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions)

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(testRuns)
      .where(whereClause)

    // Get paginated data
    const data = await db
      .select()
      .from(testRuns)
      .where(whereClause)
      .orderBy(orderFn(sortField))
      .limit(limit)
      .offset((page - 1) * limit)

    // Map to snake_case for frontend compatibility
    const mappedData = data.map(row => ({
      id: row.id,
      user_id: row.userId,
      creation_name: row.creationName,
      status: row.status,
      total_tests: row.totalTests,
      passed_tests: row.passedTests,
      failed_tests: row.failedTests,
      skipped_tests: row.skippedTests,
      backend_pass_rate: row.backendPassRate ? Number(row.backendPassRate) : null,
      frontend_pass_rate: row.frontendPassRate ? Number(row.frontendPassRate) : null,
      duration_ms: row.durationMs,
      report_json: row.reportJson,
      ai_analysis: row.aiAnalysis,
      framework: row.framework,
      source: row.source,
      created_at: row.createdAt?.toISOString() ?? null,
      updated_at: row.updatedAt?.toISOString() ?? null,
    }))

    return NextResponse.json({
      data: mappedData,
      pagination: {
        page,
        limit,
        total: total ?? 0,
        totalPages: Math.ceil((total ?? 0) / limit),
      },
    })
  } catch (error) {
    console.error('[Test Runs] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch test runs' }, { status: 500 })
  }
}
