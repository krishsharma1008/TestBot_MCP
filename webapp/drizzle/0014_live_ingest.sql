-- Prompt-2: Live Partial Ingest + In-Flight Dashboard
--
-- Adds two columns to test_runs:
--   last_heartbeat_at  — updated every 30s by the MCP worker; a run whose
--                        status is 'running' and whose heartbeat is > 5 min
--                        old is considered stalled.
--   partial_findings   — JSONB array of findings streamed by the worker before
--                        the final ingest completes; preserved after ingest for
--                        diff-debugging.

ALTER TABLE test_runs
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS partial_findings jsonb;
