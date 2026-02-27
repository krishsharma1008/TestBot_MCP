import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
  const sort_by = searchParams.get('sort_by') ?? 'created_at'
  const order = searchParams.get('order') === 'asc' ? true : false
  const status = searchParams.get('status')

  const allowedSortFields = ['created_at', 'updated_at', 'status', 'total_tests', 'duration_ms']
  const safeSort = allowedSortFields.includes(sort_by) ? sort_by : 'created_at'

  let query = supabase
    .from('test_runs')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order(safeSort, { ascending: order })
    .range((page - 1) * limit, page * limit - 1)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data,
    pagination: {
      page,
      limit,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / limit),
    },
  })
}
