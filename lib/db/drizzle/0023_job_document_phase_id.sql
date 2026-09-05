ALTER TABLE "job_documents" ADD COLUMN IF NOT EXISTS "phase_id" varchar REFERENCES "job_phases"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "idx_job_documents_phase_id" ON "job_documents" ("phase_id");
