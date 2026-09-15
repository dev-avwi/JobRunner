-- Create site_diary_entries with phase_id if it doesn't exist yet (fresh DB path),
-- then add phase_id to any existing installs that were created by the startup migration.
-- This migration is self-contained: it is safe to run before or after the startup
-- CREATE TABLE in storage.ts fires.
CREATE TABLE IF NOT EXISTS "site_diary_entries" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "job_id" varchar NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "phase_id" varchar REFERENCES "job_phases"("id") ON DELETE SET NULL,
  "entry_date" date NOT NULL,
  "weather" text,
  "workers_on_site" jsonb DEFAULT '[]'::jsonb,
  "work_done" text,
  "issues_delays" text,
  "photo_keys" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Add phase_id to pre-existing installations that already have the table.
ALTER TABLE "site_diary_entries" ADD COLUMN IF NOT EXISTS "phase_id" varchar REFERENCES "job_phases"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_site_diary_job_id" ON "site_diary_entries" ("job_id");
CREATE INDEX IF NOT EXISTS "idx_site_diary_user_id" ON "site_diary_entries" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_site_diary_entry_date" ON "site_diary_entries" ("entry_date");
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_site_diary_job_date'
  ) THEN
    ALTER TABLE "site_diary_entries"
      ADD CONSTRAINT uq_site_diary_job_date UNIQUE ("job_id", "entry_date");
  END IF;
END $$;
