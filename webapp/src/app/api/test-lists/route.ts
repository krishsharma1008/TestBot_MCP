import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { testLists } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await db
      .select()
      .from(testLists)
      .where(eq(testLists.userId, user.id))
      .orderBy(desc(testLists.createdAt))

    // Map to snake_case for frontend compatibility
    const mappedData = data.map(row => ({
      id: row.id,
      user_id: row.userId,
      name: row.name,
      description: row.description,
      test_count: row.testCount,
      last_run_at: row.lastRunAt?.toISOString() ?? null,
      created_at: row.createdAt?.toISOString() ?? null,
      updated_at: row.updatedAt?.toISOString() ?? null,
    }))

    return NextResponse.json({ data: mappedData })
  } catch (error) {
    console.error('[Test Lists] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch test lists' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, description } = body as { name: string; description?: string }

  if (!name?.trim()) {
    return NextResponse.json({ error: 'List name is required' }, { status: 400 })
  }

  try {
    const [row] = await db
      .insert(testLists)
      .values({
        userId: user.id,
        name: name.trim(),
        description: description?.trim() ?? null,
        testCount: 0,
      })
      .returning()

    const data = {
      id: row.id,
      user_id: row.userId,
      name: row.name,
      description: row.description,
      test_count: row.testCount,
      last_run_at: row.lastRunAt?.toISOString() ?? null,
      created_at: row.createdAt?.toISOString() ?? null,
      updated_at: row.updatedAt?.toISOString() ?? null,
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    console.error('[Test Lists] POST error:', error)
    return NextResponse.json({ error: 'Failed to create test list' }, { status: 500 })
  }
}
