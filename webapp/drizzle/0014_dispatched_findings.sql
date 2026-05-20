-- Dispatched findings: idempotency ledger for the outbound dispatch router
-- (Slack / GitHub / Jira). One row per (user, finding_key, adapter) tuple —
-- the unique constraint is what guarantees we never double-page on the same
-- finding when an ingest replays.

CREATE TABLE IF NOT EXISTS dispatched_findings (
  id            SERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  finding_key   TEXT NOT NULL,
  adapter       TEXT NOT NULL,
  external_ref  TEXT,
  payload       JSONB,
  dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, finding_key, adapter)
);

CREATE INDEX IF NOT EXISTS idx_dispatched_findings_user
  ON dispatched_findings(user_id);
