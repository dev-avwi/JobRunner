-- Task #115: opt-in sample data flag for onboarding "Try with sample data".
-- Adds is_sample to clients/jobs/quotes/invoices (default false) plus a
-- partial index per table so scans for sample rows stay fast and the index
-- only carries the small per-user sample subset.

ALTER TABLE "clients"  ADD COLUMN IF NOT EXISTS "is_sample" boolean NOT NULL DEFAULT false;
ALTER TABLE "jobs"     ADD COLUMN IF NOT EXISTS "is_sample" boolean NOT NULL DEFAULT false;
ALTER TABLE "quotes"   ADD COLUMN IF NOT EXISTS "is_sample" boolean NOT NULL DEFAULT false;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "is_sample" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "idx_clients_is_sample"  ON "clients"  ("user_id") WHERE "is_sample" = true;
CREATE INDEX IF NOT EXISTS "idx_jobs_is_sample"     ON "jobs"     ("user_id") WHERE "is_sample" = true;
CREATE INDEX IF NOT EXISTS "idx_quotes_is_sample"   ON "quotes"   ("user_id") WHERE "is_sample" = true;
CREATE INDEX IF NOT EXISTS "idx_invoices_is_sample" ON "invoices" ("user_id") WHERE "is_sample" = true;
