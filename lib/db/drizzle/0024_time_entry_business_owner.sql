-- Add business_owner_id to time_entries so job-less entries (travel, admin,
-- training, other) can be scoped to a specific tenant in multi-business worker
-- scenarios. Entries that carry a jobId derive their tenant through the job
-- and do not require this column; null here is safe for all existing rows.
ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "business_owner_id" varchar REFERENCES "users"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "idx_time_entries_business_owner_id" ON "time_entries" ("business_owner_id");
