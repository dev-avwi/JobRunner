-- Add optional phase_id to time_entries, job_materials, and purchase_orders so
-- costs can be explicitly attributed to a phase rather than inferred by date window.
-- No FK constraint: app-level validation enforces job/business scoping, and this
-- migration must be compatible with both varchar and UUID primary-key schemas.
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS phase_id varchar;
ALTER TABLE job_materials ADD COLUMN IF NOT EXISTS phase_id varchar;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS phase_id varchar;
