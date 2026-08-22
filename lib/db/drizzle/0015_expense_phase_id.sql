-- Expenses are assigned to a phase at the application layer. Do not add an FK:
-- supported databases use different underlying types for job_phases.id.
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS phase_id varchar;
CREATE INDEX IF NOT EXISTS idx_expenses_phase_id ON expenses (phase_id);
