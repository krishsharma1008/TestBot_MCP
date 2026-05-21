-- Live partial ingest: heartbeat tracking
-- Adds last_heartbeat_at so the dashboard can detect stalled runs
-- (no heartbeat for > 5 minutes while status = 'in_progress').
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ;

-- Enable Supabase Realtime on test_runs so the browser can subscribe to
-- row-level UPDATE events (partial findings, heartbeat, phase changes)
-- without polling. The DO block makes this idempotent — it's safe to run
-- even if the publication already includes test_runs.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE test_runs;
    EXCEPTION WHEN duplicate_object THEN
      -- Table already in publication; ignore.
      NULL;
    END;
  END IF;
END $$;
