-- Adds the per-business "Today's Schedule" drag-to-reorder column.
-- Safe to run repeatedly. Existing jobs keep NULL and fall through to the
-- scheduledAt-based ordering — server-side sort treats NULL as "no manual order".
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS schedule_order integer;
