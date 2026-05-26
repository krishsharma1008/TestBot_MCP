import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { workspaceMembers, testRuns, qaTestCaseRuns, qaTestCases } from '@/lib/db/schema'
import { eq, and, desc, inArray } from 'drizzle-orm'
import { requireWorkspaceAuth } from '@/lib/workspace-auth'

export const runtime = 'nodejs'

export interface RunSummary {
  id: string
  creationName: string | null
  status: string | null
  totalTests: number
  passedTests: number
  failedTests: number
  skippedTests: number
  durationMs: number | null
  framework: string | null
  createdAt: string | null
  passRate: number | null
}

export interface TestItem {
  caseKey: string
  testName: string
  filePath: string | null
  suite: string | null
  tier: string | null
  testType: string | null
}

export interface RunComparisonData {
  latest: RunSummary | null
  previous: RunSummary | null
  diff: {
    passRateDelta: number | null
    totalTestsDelta: number
    passedDelta: number
    failedDelta: number
    durationDelta: number | null
    newFiles: string[]
    removedFiles: string[]
    fixedTests: TestItem[]
    regressions: TestItem[]
    newTests: TestItem[]
    droppedTests: TestItem[]
    testTypeBreakdown: Array<{ type: string; count: number }>
    tierBreakdown: Array<{ tier: string; passed: number; failed: number; skipped: number; total: number }>
  } | null
}

/**
 * GET /api/workspaces/[id]/run-comparison
 *
 * Returns a structured diff between the two most recent completed test runs for
 * this workspace. Returns { latest, previous, diff: null } when fewer than 2
 * runs exist. Never throws — worst case it returns nulls.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWorkspaceAuth(request)
  if ('error' in auth) return auth.error

  const { id: workspaceId } = await params

  const [membership] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, auth.user.userId)))
    .limit(1)

  if (!membership) {
    return NextResponse.json({ error: 'Workspace not found or access denied' }, { status: 404 })
  }

  try {
    const data = await computeRunComparison(workspaceId)
    return NextResponse.json(data)
  } catch (err) {
    console.error('[run-comparison] failed', err)
    return NextResponse.json({ latest: null, previous: null, diff: null } satisfies RunComparisonData)
  }
}

export async function computeRunComparison(workspaceId: string): Promise<RunComparisonData> {
  // Fetch the two most recent runs for this workspace (any terminal status)
  const runs = await db
    .select({
      id: testRuns.id,
      creationName: testRuns.creationName,
      status: testRuns.status,
      totalTests: testRuns.totalTests,
      passedTests: testRuns.passedTests,
      failedTests: testRuns.failedTests,
      skippedTests: testRuns.skippedTests,
      durationMs: testRuns.durationMs,
      framework: testRuns.framework,
      createdAt: testRuns.createdAt,
    })
    .from(testRuns)
    .where(eq(testRuns.workspaceId, workspaceId))
    .orderBy(desc(testRuns.createdAt))
    .limit(2)

  if (runs.length === 0) {
    return { latest: null, previous: null, diff: null }
  }

  const toSummary = (r: typeof runs[number]): RunSummary => {
    const total = r.totalTests ?? 0
    const passed = r.passedTests ?? 0
    return {
      id: r.id,
      creationName: r.creationName,
      status: r.status,
      totalTests: total,
      passedTests: passed,
      failedTests: r.failedTests ?? 0,
      skippedTests: r.skippedTests ?? 0,
      durationMs: r.durationMs ?? null,
      framework: r.framework ?? null,
      createdAt: r.createdAt?.toISOString() ?? null,
      passRate: total > 0 ? Math.round((passed / total) * 1000) / 10 : null,
    }
  }

  const latest = toSummary(runs[0])

  if (runs.length === 1) {
    return { latest, previous: null, diff: null }
  }

  const previous = toSummary(runs[1])
  const latestRunId = runs[0].id
  const previousRunId = runs[1].id

  // Load test-case-run rows for both runs
  const [latestRuns, previousRuns] = await Promise.all([
    db
      .select({
        caseKey: qaTestCaseRuns.caseKey,
        testName: qaTestCaseRuns.testName,
        status: qaTestCaseRuns.status,
        filePath: qaTestCaseRuns.filePath,
        suite: qaTestCaseRuns.suite,
      })
      .from(qaTestCaseRuns)
      .where(eq(qaTestCaseRuns.testRunId, latestRunId)),
    db
      .select({
        caseKey: qaTestCaseRuns.caseKey,
        testName: qaTestCaseRuns.testName,
        status: qaTestCaseRuns.status,
        filePath: qaTestCaseRuns.filePath,
        suite: qaTestCaseRuns.suite,
      })
      .from(qaTestCaseRuns)
      .where(eq(qaTestCaseRuns.testRunId, previousRunId)),
  ])

  // Deduplicate by caseKey (keep last attempt = latest row, order preserved by PK)
  const dedupeByKey = (rows: typeof latestRuns) => {
    const map = new Map<string, typeof rows[number]>()
    for (const r of rows) map.set(r.caseKey, r)
    return map
  }
  const latestMap = dedupeByKey(latestRuns)
  const previousMap = dedupeByKey(previousRuns)

  // Collect all caseKeys seen in latest run for metadata lookup
  const allLatestKeys = Array.from(latestMap.keys())
  const allPreviousKeys = Array.from(previousMap.keys())

  // Pull tier + testType from qa_test_cases for relevant keys
  const allKeys = Array.from(new Set([...allLatestKeys, ...allPreviousKeys]))
  const caseMetaMap = new Map<string, { tier: string | null; testType: string | null }>()
  if (allKeys.length > 0) {
    const caseRows = await db
      .select({ caseKey: qaTestCases.caseKey, tier: qaTestCases.tier, testType: qaTestCases.testType })
      .from(qaTestCases)
      .where(inArray(qaTestCases.caseKey, allKeys.slice(0, 2000))) // safety cap
    for (const c of caseRows) {
      caseMetaMap.set(c.caseKey, { tier: c.tier ?? null, testType: c.testType ?? null })
    }
  }

  const toItem = (row: { caseKey: string; testName: string; filePath: string | null; suite: string | null }): TestItem => ({
    caseKey: row.caseKey,
    testName: row.testName,
    filePath: row.filePath ?? null,
    suite: row.suite ?? null,
    tier: caseMetaMap.get(row.caseKey)?.tier ?? null,
    testType: caseMetaMap.get(row.caseKey)?.testType ?? null,
  })

  // File-level diff
  const latestFiles = new Set(Array.from(latestMap.values()).map((r) => r.filePath).filter(Boolean) as string[])
  const previousFiles = new Set(Array.from(previousMap.values()).map((r) => r.filePath).filter(Boolean) as string[])
  const newFiles = Array.from(latestFiles).filter((f) => !previousFiles.has(f)).sort()
  const removedFiles = Array.from(previousFiles).filter((f) => !latestFiles.has(f)).sort()

  // Test-level diffs
  const fixedTests: TestItem[] = []
  const regressions: TestItem[] = []
  for (const [key, prevRow] of previousMap) {
    const latestRow = latestMap.get(key)
    if (!latestRow) continue
    const prevFailed = prevRow.status === 'failed'
    const latestPassed = latestRow.status === 'passed'
    const prevPassed = prevRow.status === 'passed'
    const latestFailed = latestRow.status === 'failed'
    if (prevFailed && latestPassed) fixedTests.push(toItem(latestRow))
    if (prevPassed && latestFailed) regressions.push(toItem(latestRow))
  }

  const newTests: TestItem[] = []
  const droppedTests: TestItem[] = []
  for (const [key, row] of latestMap) {
    if (!previousMap.has(key)) newTests.push(toItem(row))
  }
  for (const [key, row] of previousMap) {
    if (!latestMap.has(key)) droppedTests.push(toItem(row))
  }

  // Test-type breakdown for latest run
  const typeCount = new Map<string, number>()
  for (const key of allLatestKeys) {
    const t = caseMetaMap.get(key)?.testType ?? 'unknown'
    typeCount.set(t, (typeCount.get(t) ?? 0) + 1)
  }
  const testTypeBreakdown = Array.from(typeCount.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)

  // Tier breakdown for latest run
  const tierMap = new Map<string, { passed: number; failed: number; skipped: number; total: number }>()
  for (const [key, row] of latestMap) {
    const tier = caseMetaMap.get(key)?.tier ?? 'unknown'
    const bucket = tierMap.get(tier) ?? { passed: 0, failed: 0, skipped: 0, total: 0 }
    bucket.total++
    if (row.status === 'passed') bucket.passed++
    else if (row.status === 'failed') bucket.failed++
    else bucket.skipped++
    tierMap.set(tier, bucket)
  }
  const TIER_ORDER = ['L0', 'L1', 'L2', 'L3', 'unknown']
  const tierBreakdown = Array.from(tierMap.entries())
    .map(([tier, counts]) => ({ tier, ...counts }))
    .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier))

  // Scalar deltas
  const passRateDelta =
    latest.passRate !== null && previous.passRate !== null
      ? Math.round((latest.passRate - previous.passRate) * 10) / 10
      : null
  const durationDelta =
    latest.durationMs !== null && previous.durationMs !== null
      ? latest.durationMs - previous.durationMs
      : null

  return {
    latest,
    previous,
    diff: {
      passRateDelta,
      totalTestsDelta: latest.totalTests - previous.totalTests,
      passedDelta: latest.passedTests - previous.passedTests,
      failedDelta: latest.failedTests - previous.failedTests,
      durationDelta,
      newFiles,
      removedFiles,
      fixedTests,
      regressions,
      newTests,
      droppedTests,
      testTypeBreakdown,
      tierBreakdown,
    },
  }
}
