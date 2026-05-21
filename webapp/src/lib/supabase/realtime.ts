import { createSupabaseBrowserClient } from './client'

export type RunRealtimeUpdate = {
  status?: string
  tier_results?: unknown
  partial_findings?: unknown[]
  last_heartbeat_at?: string
  current_phase?: string
  total_tests?: number
  passed_tests?: number
  failed_tests?: number
  skipped_tests?: number
  updated_at?: string
}

/**
 * Subscribe to real-time updates for a single test_runs row.
 *
 * The Supabase realtime publication must include the `test_runs` table
 * (Supabase Dashboard → Database → Replication → supabase_realtime).
 *
 * Returns an unsubscribe function — call it in useEffect cleanup.
 *
 * RLS note: this uses the public anon key. Supabase realtime respects
 * row-level security; add a SELECT policy on test_runs if you enable RLS.
 */
export function subscribeToRun(
  runId: string,
  onUpdate: (update: RunRealtimeUpdate) => void
): () => void {
  const supabase = createSupabaseBrowserClient()

  const channel = supabase
    .channel(`run-${runId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'test_runs',
        filter: `id=eq.${runId}`,
      },
      (payload) => {
        const row = payload.new as Record<string, unknown>
        onUpdate({
          status: typeof row.status === 'string' ? row.status : undefined,
          tier_results: row.tier_results ?? undefined,
          partial_findings: Array.isArray(row.partial_findings) ? (row.partial_findings as unknown[]) : undefined,
          last_heartbeat_at: typeof row.last_heartbeat_at === 'string' ? row.last_heartbeat_at : undefined,
          current_phase: typeof row.current_phase === 'string' ? row.current_phase : undefined,
          total_tests: typeof row.total_tests === 'number' ? row.total_tests : undefined,
          passed_tests: typeof row.passed_tests === 'number' ? row.passed_tests : undefined,
          failed_tests: typeof row.failed_tests === 'number' ? row.failed_tests : undefined,
          skipped_tests: typeof row.skipped_tests === 'number' ? row.skipped_tests : undefined,
          updated_at: typeof row.updated_at === 'string' ? row.updated_at : undefined,
        })
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
