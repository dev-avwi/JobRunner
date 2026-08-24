-- Add per-task cost tracking columns (all nullable; existing rows get NULL)
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "estimated_hours" numeric(8, 2);
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "actual_hours" numeric(8, 2);
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "estimated_material_cost" numeric(10, 2);
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "actual_material_cost" numeric(10, 2);
