-- Add optional phase link to project documents so docs can be scoped to a phase.
-- ON DELETE SET NULL so deleting a phase keeps the document (just unlinked).

ALTER TABLE project_documents
  ADD COLUMN IF NOT EXISTS phase_id VARCHAR REFERENCES job_phases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_documents_phase_id ON project_documents (phase_id);
