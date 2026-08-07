#!/bin/bash
set -e
npm install
echo "Applying schema changes via direct SQL (drizzle-kit push is interactive and times out)..."
psql "$DATABASE_URL" -c "ALTER TABLE ai_receptionist_calls ADD COLUMN IF NOT EXISTS sentiment text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE ai_receptionist_calls ADD COLUMN IF NOT EXISTS sentiment_score real;" 2>/dev/null || true
# Task #86 (Integrations Health Pass): timezone + quickbooks_default_item_ref
psql "$DATABASE_URL" -c "ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Australia/Sydney';" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS quickbooks_default_item_ref jsonb;" 2>/dev/null || true
# Accounting integration tax/item refs + webhook tracking (sync gap fix)
psql "$DATABASE_URL" -c "ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS xero_sales_account_id text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS qbo_sales_account_id text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS myob_income_account_id text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS xero_tax_rate_id text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS xero_default_item_code text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS xero_active_tenant_id text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS xero_last_webhook_at timestamp;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS qbo_tax_rate_id text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS qbo_default_item_id text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS qbo_last_webhook_at timestamp;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS myob_tax_code_id text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS myob_default_item_id text;" 2>/dev/null || true

# Task #108 (E2E audit): drift discovered against shared/schema.ts.
# ai_receptionist_calls — Vapi call telemetry columns
psql "$DATABASE_URL" -c "ALTER TABLE ai_receptionist_calls ADD COLUMN IF NOT EXISTS called_number text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE ai_receptionist_calls ADD COLUMN IF NOT EXISTS latency_ms integer;" 2>/dev/null || true
# xero_sync_state — sync run start timestamp
psql "$DATABASE_URL" -c "ALTER TABLE xero_sync_state ADD COLUMN IF NOT EXISTS started_at timestamp;" 2>/dev/null || true
# worker_states — per-worker live status
psql "$DATABASE_URL" -c "CREATE TABLE IF NOT EXISTS worker_states (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_owner_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'available',
  job_id varchar,
  note text,
  updated_at timestamp DEFAULT now(),
  created_at timestamp DEFAULT now(),
  CONSTRAINT uq_worker_states_biz_user UNIQUE (business_owner_id, user_id)
);" 2>/dev/null || true
psql "$DATABASE_URL" -c "CREATE INDEX IF NOT EXISTS idx_worker_states_user ON worker_states (user_id);" 2>/dev/null || true
psql "$DATABASE_URL" -c "CREATE INDEX IF NOT EXISTS idx_worker_states_business ON worker_states (business_owner_id);" 2>/dev/null || true
# number_port_requests — BYOD number-port admin workflow
psql "$DATABASE_URL" -c "CREATE TABLE IF NOT EXISTS number_port_requests (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  current_carrier text NOT NULL,
  account_number text NOT NULL,
  authorisation_agreed boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'submitted',
  admin_notes text,
  estimated_completion_date timestamp,
  completed_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);" 2>/dev/null || true
psql "$DATABASE_URL" -c "CREATE INDEX IF NOT EXISTS idx_port_requests_user ON number_port_requests (user_id);" 2>/dev/null || true
psql "$DATABASE_URL" -c "CREATE INDEX IF NOT EXISTS idx_port_requests_status ON number_port_requests (status);" 2>/dev/null || true

# Task #116 (Chat Hub Quick Replies): quick_replies table
psql "$DATABASE_URL" -c "CREATE TABLE IF NOT EXISTS quick_replies (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label varchar(60) NOT NULL,
  body text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);" 2>/dev/null || true
psql "$DATABASE_URL" -c "CREATE INDEX IF NOT EXISTS quick_replies_user_id_idx ON quick_replies (user_id);" 2>/dev/null || true

# Task #115 (First-run sample data toggle): is_sample flag on core tables
psql "$DATABASE_URL" -c "ALTER TABLE clients  ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE jobs     ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE quotes   ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;" 2>/dev/null || true
psql "$DATABASE_URL" -c "CREATE INDEX IF NOT EXISTS idx_clients_is_sample  ON clients  (user_id) WHERE is_sample = true;" 2>/dev/null || true
psql "$DATABASE_URL" -c "CREATE INDEX IF NOT EXISTS idx_jobs_is_sample     ON jobs     (user_id) WHERE is_sample = true;" 2>/dev/null || true
psql "$DATABASE_URL" -c "CREATE INDEX IF NOT EXISTS idx_quotes_is_sample   ON quotes   (user_id) WHERE is_sample = true;" 2>/dev/null || true
psql "$DATABASE_URL" -c "CREATE INDEX IF NOT EXISTS idx_invoices_is_sample ON invoices (user_id) WHERE is_sample = true;" 2>/dev/null || true

# Task #114 (Today's Schedule v2): per-day drag-reorder column on jobs
psql "$DATABASE_URL" -c "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS schedule_order integer;" 2>/dev/null || true

# Task #194 (Subbie-Bills-Business Billing Builder): additive billing columns.
# ADDITIVE ONLY (matches migrations/0019_subbie_billing_builder.sql + shared/schema.ts).
psql "$DATABASE_URL" -c "ALTER TABLE subcontractor_invoices ADD COLUMN IF NOT EXISTS doc_type text NOT NULL DEFAULT 'invoice';" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE subcontractor_invoices ADD COLUMN IF NOT EXISTS title text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE subcontractor_invoices ADD COLUMN IF NOT EXISTS gst_enabled boolean NOT NULL DEFAULT true;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE subcontractor_invoices ADD COLUMN IF NOT EXISTS valid_until timestamp;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE subcontractor_invoice_items ADD COLUMN IF NOT EXISTS quantity numeric(10,2);" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE subcontractor_invoice_items ADD COLUMN IF NOT EXISTS unit_price numeric(10,2);" 2>/dev/null || true

# Task #198 (Week-1 retention): user_activity table (one row per user per day).
psql "$DATABASE_URL" -c "CREATE TABLE IF NOT EXISTS user_activity (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_date date NOT NULL,
  created_at timestamp DEFAULT now(),
  CONSTRAINT uq_user_activity_user_date UNIQUE (user_id, activity_date)
);" 2>/dev/null || true
psql "$DATABASE_URL" -c "CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity (user_id);" 2>/dev/null || true
psql "$DATABASE_URL" -c "CREATE INDEX IF NOT EXISTS idx_user_activity_date ON user_activity (activity_date);" 2>/dev/null || true

# Task #271 (Subcontractor & payroll payments): money-side tables + columns.
# MUST run BEFORE the drift guard below, or the guard exits non-zero on a
# fresh DB before these columns/tables are created.
psql "$DATABASE_URL" -c "ALTER TABLE subcontractor_invoices ADD COLUMN IF NOT EXISTS paid_reference text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE subcontractor_invoices ADD COLUMN IF NOT EXISTS paid_notes text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE subcontractor_invoices ADD COLUMN IF NOT EXISTS remittance_sent_at timestamp;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE subcontractor_invoices ADD COLUMN IF NOT EXISTS accounting_provider text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE subcontractor_invoices ADD COLUMN IF NOT EXISTS accounting_bill_id text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE subcontractor_invoices ADD COLUMN IF NOT EXISTS accounting_synced_at timestamp;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE subcontractor_invoices ADD COLUMN IF NOT EXISTS accounting_sync_error text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "CREATE TABLE IF NOT EXISTS worker_payment_details (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  bank_bsb text,
  bank_account_number text,
  bank_account_name text,
  abn text,
  pay_id text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);" 2>/dev/null || true
psql "$DATABASE_URL" -c "CREATE INDEX IF NOT EXISTS idx_worker_payment_details_user ON worker_payment_details (user_id);" 2>/dev/null || true
psql "$DATABASE_URL" -c "CREATE TABLE IF NOT EXISTS payroll_payments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  business_owner_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_member_id varchar REFERENCES team_members(id) ON DELETE SET NULL,
  period_start timestamp NOT NULL,
  period_end timestamp NOT NULL,
  regular_hours decimal(10,2) NOT NULL DEFAULT '0',
  overtime_hours decimal(10,2) NOT NULL DEFAULT '0',
  total_hours decimal(10,2) NOT NULL DEFAULT '0',
  gross_pay decimal(10,2) NOT NULL DEFAULT '0',
  method text NOT NULL DEFAULT 'bank_transfer',
  reference text,
  notes text,
  paid_at timestamp NOT NULL DEFAULT now(),
  remittance_sent_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);" 2>/dev/null || true
psql "$DATABASE_URL" -c "CREATE INDEX IF NOT EXISTS idx_payroll_payments_business ON payroll_payments (business_owner_id);" 2>/dev/null || true
psql "$DATABASE_URL" -c "CREATE INDEX IF NOT EXISTS idx_payroll_payments_worker ON payroll_payments (worker_user_id);" 2>/dev/null || true
psql "$DATABASE_URL" -c "CREATE INDEX IF NOT EXISTS idx_payroll_payments_period ON payroll_payments (period_start, period_end);" 2>/dev/null || true
psql "$DATABASE_URL" -c "CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_payments_worker_period ON payroll_payments (business_owner_id, worker_user_id, period_start, period_end);" 2>/dev/null || true

# Compliance attachment columns (safety docs upload)
psql "$DATABASE_URL" -c "ALTER TABLE swms_documents ADD COLUMN IF NOT EXISTS attachment_type text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE swms_documents ADD COLUMN IF NOT EXISTS attachment_url text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE training_records ADD COLUMN IF NOT EXISTS attachment_type text;" 2>/dev/null || true
psql "$DATABASE_URL" -c "ALTER TABLE training_records ADD COLUMN IF NOT EXISTS attachment_url text;" 2>/dev/null || true

# Drift guard rail (Task #108): refuse to deploy if schema.ts and the live DB
# disagree after the ALTERs above. Logs the diff and exits non-zero.
# Task 300: import traceability (import_runs + origin tags)
psql "$DATABASE_URL" -c "CREATE TABLE IF NOT EXISTS import_runs (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE, file_name text NOT NULL, file_path text, file_size integer, source text NOT NULL DEFAULT 'csv', platform text, type text NOT NULL DEFAULT 'unknown', status text NOT NULL DEFAULT 'pending', records_imported integer NOT NULL DEFAULT 0, records_merged integer NOT NULL DEFAULT 0, records_skipped integer NOT NULL DEFAULT 0, records_removed integer NOT NULL DEFAULT 0, completed_at timestamp, undone_at timestamp, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());" 2>/dev/null || true
psql "$DATABASE_URL" -c "CREATE INDEX IF NOT EXISTS idx_import_runs_user_id ON import_runs(user_id);" 2>/dev/null || true
for t in clients jobs quotes invoices line_item_catalog; do
  psql "$DATABASE_URL" -c "ALTER TABLE $t ADD COLUMN IF NOT EXISTS import_run_id varchar;" 2>/dev/null || true
  psql "$DATABASE_URL" -c "ALTER TABLE $t ADD COLUMN IF NOT EXISTS import_row_number integer;" 2>/dev/null || true
  psql "$DATABASE_URL" -c "CREATE INDEX IF NOT EXISTS idx_${t}_import_run_id ON $t(import_run_id) WHERE import_run_id IS NOT NULL;" 2>/dev/null || true
done

echo "Verifying schema is in sync with shared/schema.ts..."
node scripts/check-schema-drift.mjs

echo "Schema changes applied."
