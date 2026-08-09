-- Task 300: Import traceability, history and undo
-- Apply with psql directly (drizzle-kit push is destructive on this DB).

CREATE TABLE IF NOT EXISTS import_runs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text,
  file_size integer,
  source text NOT NULL DEFAULT 'csv',
  platform text,
  type text NOT NULL DEFAULT 'unknown',
  status text NOT NULL DEFAULT 'pending',
  records_imported integer NOT NULL DEFAULT 0,
  records_merged integer NOT NULL DEFAULT 0,
  records_skipped integer NOT NULL DEFAULT 0,
  records_removed integer NOT NULL DEFAULT 0,
  completed_at timestamp,
  undone_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_import_runs_user_id ON import_runs(user_id);

ALTER TABLE clients ADD COLUMN IF NOT EXISTS import_run_id varchar;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS import_row_number integer;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS import_run_id varchar;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS import_row_number integer;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS import_run_id varchar;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS import_row_number integer;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS import_run_id varchar;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS import_row_number integer;
ALTER TABLE line_item_catalog ADD COLUMN IF NOT EXISTS import_run_id varchar;
ALTER TABLE line_item_catalog ADD COLUMN IF NOT EXISTS import_row_number integer;

CREATE INDEX IF NOT EXISTS idx_clients_import_run_id ON clients(import_run_id) WHERE import_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_import_run_id ON jobs(import_run_id) WHERE import_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_import_run_id ON quotes(import_run_id) WHERE import_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_import_run_id ON invoices(import_run_id) WHERE import_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_line_item_catalog_import_run_id ON line_item_catalog(import_run_id) WHERE import_run_id IS NOT NULL;
