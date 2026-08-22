-- Expenses can be assigned to a project phase. Keep the database reference
-- nullable so historical and unallocated expenses remain valid.
ALTER TABLE "expenses"
  ADD COLUMN IF NOT EXISTS "phase_id" varchar;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'expenses'::regclass
      AND conname = 'expenses_phase_id_job_phases_id_fk'
  ) THEN
    ALTER TABLE "expenses"
      ADD CONSTRAINT "expenses_phase_id_job_phases_id_fk"
      FOREIGN KEY ("phase_id") REFERENCES "job_phases"("id")
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_expenses_phase_id"
  ON "expenses" USING btree ("phase_id");