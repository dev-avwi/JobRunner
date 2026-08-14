-- Migration: unique partial index preventing concurrent retention-release claims.
-- Enforces at the DB level that at most one active (non-cancelled) Retention Release
-- claim can exist per job. Combined with the application-level 409 guard this gives
-- true atomic duplicate protection even under concurrent requests.
-- Safe to run multiple times (IF NOT EXISTS).

CREATE UNIQUE INDEX IF NOT EXISTS idx_claims_one_retention_release_active
  ON claims (job_id)
  WHERE lower(trim(notes)) = 'retention release'
    AND status IN ('draft', 'submitted', 'approved', 'paid');
