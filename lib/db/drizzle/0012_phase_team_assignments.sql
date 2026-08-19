-- Multi-member phase teams. job_phases.assigned_user_id remains the lead
-- assignment for backwards-compatible consumers while this join table carries
-- every assigned team member.
CREATE TABLE IF NOT EXISTS job_phase_assignments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id varchar NOT NULL REFERENCES job_phases(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_lead boolean NOT NULL DEFAULT false,
  created_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_job_phase_assignments_phase_user
  ON job_phase_assignments (phase_id, user_id);
CREATE INDEX IF NOT EXISTS idx_job_phase_assignments_phase_id
  ON job_phase_assignments (phase_id);
CREATE INDEX IF NOT EXISTS idx_job_phase_assignments_user_id
  ON job_phase_assignments (user_id);

-- Preserve every existing single assignee as the lead member of its phase.
INSERT INTO job_phase_assignments (id, phase_id, user_id, is_lead)
SELECT gen_random_uuid(), id, assigned_user_id, true
FROM job_phases
WHERE assigned_user_id IS NOT NULL
ON CONFLICT (phase_id, user_id) DO NOTHING;