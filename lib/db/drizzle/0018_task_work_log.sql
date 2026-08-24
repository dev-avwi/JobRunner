-- Task work log: junction tables linking tasks to time entries and job materials
-- Team members can log hours and materials directly on a task

CREATE TABLE IF NOT EXISTS task_time_entries (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id varchar NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  time_entry_id varchar NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT now(),
  CONSTRAINT uq_task_time_entries UNIQUE (task_id, time_entry_id)
);

CREATE INDEX IF NOT EXISTS idx_task_time_entries_task_id ON task_time_entries(task_id);

CREATE TABLE IF NOT EXISTS task_materials (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id varchar NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  job_material_id varchar NOT NULL REFERENCES job_materials(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT now(),
  CONSTRAINT uq_task_materials UNIQUE (task_id, job_material_id)
);

CREATE INDEX IF NOT EXISTS idx_task_materials_task_id ON task_materials(task_id);
