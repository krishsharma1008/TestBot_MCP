import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { testRuns, testFailures } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

/**
 * PATCH /api/test-runs/[id]/findings
 * Live ingest endpoint for streaming findings during pipeline execution
 * Performs idempotent upsert based on findingKey
 */
export async function PATCH(
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

    const findings = await request.json()

    if (!Array.isArray(findings)) {
      return NextResponse.json({ error: 'Invalid payload: expected array of findings' }, { status: 400 })
    }

    console.log('[PATCH /api/test-runs/[id]/findings] Received findings:', {
      testRunId: id,
      count: findings.length,
      tiers: findings.map(f => f.tier),
    })

    // Perform idempotent upsert for each finding
    for (const finding of findings) {
      const findingKey = finding.findingKey || finding.id || `${finding.test_name}-${finding.verdict}`

      // Check if finding already exists
      const [existing] = await db
        .select()
        .from(testFailures)
        .where(
          and(
            eq(testFailures.testRunId, id),
            eq(testFailures.userId, user.id),
            eq(testFailures.testName, finding.test_name || finding.testName)
          )
        )
        .limit(1)

      if (existing) {
        // Update existing finding with tier if not set
        if (!existing.tier && finding.tier) {
          await db
            .update(testFailures)
            .set({ tier: finding.tier })
            .where(eq(testFailures.id, existing.id))
        }
      } else {
        // Insert new finding with tier
        await db.insert(testFailures).values({
          userId: user.id,
          testRunId: id,
          testName: finding.test_name || finding.testName,
          testFile: finding.test_file || finding.testFile || null,
          tier: finding.tier || 'tier-3',
          verdict: finding.verdict || 'ambiguous',
          verdictSource: finding.verdict_source || finding.verdictSource || null,
          verdictConfidence: finding.verdict_confidence || finding.verdictConfidence || null,
          fixTarget: finding.fix_target || finding.fixTarget || null,
          reason: finding.reason || null,
          suggestedPatch: finding.suggested_patch || finding.suggestedPatch || null,
          evidence: finding.evidence || null,
          clusterId: finding.cluster_id || finding.clusterId || null,
          createdAt: new Date(),
        })
      }
    }

    console.log('[PATCH /api/test-runs/[id]/findings] Successfully upserted findings')
    return NextResponse.json({ success: true, count: findings.length })
  } catch (error) {
    console.error('[PATCH /api/test-runs/[id]/findings] Error:', error)
    return NextResponse.json({ error: 'Failed to upsert findings' }, { status: 500 })
  }
}
