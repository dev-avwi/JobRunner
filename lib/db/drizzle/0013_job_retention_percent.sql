-- Default retention rate for project progress claims.
-- Existing jobs remain at zero retention until a rate is configured.
ALTER TABLE "jobs"
  ADD COLUMN IF NOT EXISTS "retention_percent" numeric(5, 2) NOT NULL DEFAULT 0.00;