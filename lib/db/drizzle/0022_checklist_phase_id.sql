-- Add optional phase link to checklist items so tasks can be scoped to a phase.
-- ON DELETE SET NULL so deleting a phase keeps the checklist item (just unlinked).

ALTER TABLE checklist_items
  ADD COLUMN IF NOT EXISTS phase_id VARCHAR REFERENCES job_phases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_checklist_items_phase_id ON checklist_items (phase_id);
