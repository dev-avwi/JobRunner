-- Migration: retention ledger fields on the jobs table
-- Supports project-type jobs with progress claims. Tracks practical completion
-- date and defects liability period so the retention ledger can compute when
-- the holdback is due for release.
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS).

ALTER TABLE "jobs"
  ADD COLUMN IF NOT EXISTS "practical_completion_date" date,
  ADD COLUMN IF NOT EXISTS "defects_liability_months" integer DEFAULT 12;
