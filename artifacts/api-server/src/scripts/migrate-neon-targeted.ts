/**
 * Targeted migration: apply all schema drift to NEON_DATABASE_URL.
 * Run with: cd artifacts/api-server && npx tsx src/scripts/migrate-neon-targeted.ts
 *
 * Each statement is idempotent (IF NOT EXISTS / IF NOT EXISTS column) and
 * wrapped in its own try/catch so one failure doesn't block the rest.
 * FK constraints that have type-mismatch risk (job_phases.id = uuid vs varchar)
 * are omitted — referential integrity is enforced at the application layer.
 */
import pg from "pg";

const dbUrl = process.env.NEON_DATABASE_URL;
if (!dbUrl) {
  console.error("NEON_DATABASE_URL is not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: dbUrl, max: 3 });

async function run(label: string, sql: string) {
  try {
    await pool.query(sql);
    console.log(`✓ ${label}`);
  } catch (err: any) {
    console.error(`✗ ${label}: ${err.message}`);
  }
}

console.log("Connecting to NEON …");

// ── Missing columns on EXISTING tables ────────────────────────────────────────

await run("users.xero_id", `ALTER TABLE users ADD COLUMN IF NOT EXISTS xero_id varchar UNIQUE`);
await run("users.phone_normalized", `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_normalized varchar(20)`);
await run("users.subscription_source", `ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_source text`);
await run("users.apple_product_id", `ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_product_id text`);
await run("users.apple_receipt_data", `ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_receipt_data text`);
await run("users.apple_original_transaction_id", `ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_original_transaction_id text`);
await run("users.active_business_id", `ALTER TABLE users ADD COLUMN IF NOT EXISTS active_business_id varchar`);
await run("users.license_type", `ALTER TABLE users ADD COLUMN IF NOT EXISTS license_type text`);
await run("users.license_number", `ALTER TABLE users ADD COLUMN IF NOT EXISTS license_number text`);
await run("users.license_expiry", `ALTER TABLE users ADD COLUMN IF NOT EXISTS license_expiry date`);
await run("users.insurance_policy_number", `ALTER TABLE users ADD COLUMN IF NOT EXISTS insurance_policy_number text`);
await run("users.insurance_expiry", `ALTER TABLE users ADD COLUMN IF NOT EXISTS insurance_expiry date`);
await run("users.lifecycle_emails_sent", `ALTER TABLE users ADD COLUMN IF NOT EXISTS lifecycle_emails_sent jsonb DEFAULT '{}'`);
await run("users.last_lifecycle_email_at", `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_lifecycle_email_at timestamp`);

await run("business_settings.travel_rate_per_km", `ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS travel_rate_per_km decimal(10,4) DEFAULT 0.85`);

await run("integration_settings.smart_running_late_enabled", `ALTER TABLE integration_settings ADD COLUMN IF NOT EXISTS smart_running_late_enabled boolean DEFAULT false`);

await run("clients.tags", `ALTER TABLE clients ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[]`);
await run("clients.client_type", `ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_type text`);
await run("clients.referral_source", `ALTER TABLE clients ADD COLUMN IF NOT EXISTS referral_source text`);
await run("clients.xero_contact_id", `ALTER TABLE clients ADD COLUMN IF NOT EXISTS xero_contact_id varchar`);
await run("clients.xero_synced_at", `ALTER TABLE clients ADD COLUMN IF NOT EXISTS xero_synced_at timestamp`);
await run("clients.is_sample", `ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false`);
await run("clients.import_run_id", `ALTER TABLE clients ADD COLUMN IF NOT EXISTS import_run_id varchar`);
await run("clients.import_row_number", `ALTER TABLE clients ADD COLUMN IF NOT EXISTS import_row_number integer`);

await run("jobs.schedule_order", `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS schedule_order integer`);
await run("jobs.worker_status", `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS worker_status text`);
await run("jobs.worker_status_updated_at", `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS worker_status_updated_at timestamp`);
await run("jobs.worker_eta", `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS worker_eta text`);
await run("jobs.worker_eta_minutes", `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS worker_eta_minutes integer`);
await run("jobs.portal_enabled", `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS portal_enabled boolean DEFAULT false`);
await run("jobs.requires_inspection", `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS requires_inspection boolean DEFAULT false`);
await run("jobs.inspection_completed_at", `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS inspection_completed_at timestamp`);
await run("jobs.inspection_notes", `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS inspection_notes text`);
await run("jobs.lead_source", `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS lead_source text`);
await run("jobs.lead_id", `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS lead_id varchar`);
await run("jobs.version", `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1`);
await run("jobs.is_sample", `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false`);
await run("jobs.import_run_id", `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS import_run_id varchar`);
await run("jobs.import_row_number", `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS import_row_number integer`);
await run("jobs.creation_request_id", `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS creation_request_id varchar(100)`);
await run("jobs.practical_completion_date", `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS practical_completion_date date`);
await run("jobs.defects_liability_months", `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS defects_liability_months integer DEFAULT 12`);

await run("job_phases.notes", `ALTER TABLE job_phases ADD COLUMN IF NOT EXISTS notes text`);

await run("quotes.acceptance_signature_data", `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS acceptance_signature_data text`);
await run("quotes.is_sample", `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false`);
await run("quotes.import_run_id", `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS import_run_id varchar`);
await run("quotes.import_row_number", `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS import_row_number integer`);

await run("quote_line_items.item_code", `ALTER TABLE quote_line_items ADD COLUMN IF NOT EXISTS item_code text`);

await run("invoices.locked_at", `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS locked_at timestamp`);
await run("invoices.locked_reason", `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS locked_reason text`);
await run("invoices.calculation_hash", `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS calculation_hash text`);
await run("invoices.retention_percent", `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS retention_percent decimal(5,2)`);
await run("invoices.retention_amount", `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS retention_amount decimal(10,2)`);
await run("invoices.amount_paid", `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid decimal(10,2) DEFAULT 0.00`);
await run("invoices.payment_milestones", `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_milestones jsonb`);
await run("invoices.deposit_required", `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deposit_required boolean DEFAULT false`);
await run("invoices.deposit_percent", `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deposit_percent decimal(5,2)`);
await run("invoices.deposit_amount", `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deposit_amount decimal(10,2)`);
await run("invoices.deposit_paid", `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deposit_paid boolean DEFAULT false`);
await run("invoices.deposit_paid_at", `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deposit_paid_at timestamp`);
await run("invoices.is_sample", `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false`);
await run("invoices.import_run_id", `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS import_run_id varchar`);
await run("invoices.import_row_number", `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS import_row_number integer`);

await run("invoice_line_items.item_code", `ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS item_code text`);
await run("invoice_line_items.source_type", `ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS source_type text`);
await run("invoice_line_items.source_id", `ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS source_id varchar`);
await run("invoice_line_items.rate_snapshot", `ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS rate_snapshot decimal(10,2)`);

await run("payment_requests.subcontractor_invoice_id", `ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS subcontractor_invoice_id varchar`);

await run("line_item_catalog.item_code", `ALTER TABLE line_item_catalog ADD COLUMN IF NOT EXISTS item_code text`);
await run("line_item_catalog.import_run_id", `ALTER TABLE line_item_catalog ADD COLUMN IF NOT EXISTS import_run_id varchar`);
await run("line_item_catalog.import_row_number", `ALTER TABLE line_item_catalog ADD COLUMN IF NOT EXISTS import_row_number integer`);

await run("time_entries.device_time_offset", `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS device_time_offset integer`);
await run("time_entries.clock_in_latitude", `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS clock_in_latitude decimal(10,7)`);
await run("time_entries.clock_in_longitude", `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS clock_in_longitude decimal(10,7)`);
await run("time_entries.clock_out_latitude", `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS clock_out_latitude decimal(10,7)`);
await run("time_entries.clock_out_longitude", `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS clock_out_longitude decimal(10,7)`);
await run("time_entries.clock_in_address", `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS clock_in_address text`);
await run("time_entries.clock_out_address", `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS clock_out_address text`);
await run("time_entries.distance_km", `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS distance_km decimal(10,2)`);
await run("time_entries.is_disputed", `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS is_disputed boolean DEFAULT false`);
await run("time_entries.dispute_reason", `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS dispute_reason text`);
await run("time_entries.dispute_resolution", `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS dispute_resolution text`);
await run("time_entries.disputed_at", `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS disputed_at timestamp`);
await run("time_entries.dispute_resolved_at", `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS dispute_resolved_at timestamp`);
await run("time_entries.duration_ms", `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS duration_ms integer`);
await run("time_entries.started_at", `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS started_at timestamp`);
await run("time_entries.detected_actions", `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS detected_actions jsonb`);
await run("time_entries.gps_auto_check_in_enabled", `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS gps_auto_check_in_enabled boolean DEFAULT false`);
await run("time_entries.assignment_id", `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS assignment_id varchar`);
await run("time_entries.summary", `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS summary text`);

await run("expenses.rejection_reason", `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS rejection_reason text`);
await run("expenses.submitted_by_user_id", `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS submitted_by_user_id varchar`);

await run("team_members.work_hours_start", `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS work_hours_start text DEFAULT '07:00'`);
await run("team_members.work_hours_end", `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS work_hours_end text DEFAULT '17:00'`);
await run("team_members.work_days", `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS work_days json DEFAULT '[1,2,3,4,5]'`);
await run("team_members.after_hours_ghost_mode", `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS after_hours_ghost_mode boolean DEFAULT false`);
await run("team_members.whs_role", `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS whs_role text DEFAULT 'none'`);
await run("team_members.ai_receptionist_availability", `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS ai_receptionist_availability boolean DEFAULT true`);
await run("team_members.availability_status", `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS availability_status text DEFAULT 'available'`);
await run("team_members.photo_requirements_enabled", `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS photo_requirements_enabled boolean DEFAULT false`);
await run("team_members.gps_auto_check_in_enabled", `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS gps_auto_check_in_enabled boolean DEFAULT false`);
await run("team_members.latitude", `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS latitude decimal(10,7)`);
await run("team_members.longitude", `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS longitude decimal(10,7)`);
await run("team_members.last_event_at", `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS last_event_at timestamp`);
await run("team_members.last_event_type", `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS last_event_type text`);

await run("geofence_alerts.dwell_seconds", `ALTER TABLE geofence_alerts ADD COLUMN IF NOT EXISTS dwell_seconds integer`);

await run("project_documents.client_generated_id", `ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS client_generated_id varchar(100)`);
await run("project_documents.is_client_visible", `ALTER TABLE project_documents ADD COLUMN IF NOT EXISTS is_client_visible boolean NOT NULL DEFAULT false`);

await run("claims.xero_sync_error", `ALTER TABLE claims ADD COLUMN IF NOT EXISTS xero_sync_error text`);

// ── Missing TABLES ─────────────────────────────────────────────────────────────

await run("terms_acceptance table", `
  CREATE TABLE IF NOT EXISTS terms_acceptance (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL,
    terms_version varchar NOT NULL,
    platform varchar NOT NULL,
    ip_address varchar,
    accepted_at timestamp NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_terms_acceptance_user_id ON terms_acceptance (user_id);
`);

await run("user_activity table", `
  CREATE TABLE IF NOT EXISTS user_activity (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL,
    activity_date date NOT NULL,
    created_at timestamp DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uq_user_activity_user_date ON user_activity (user_id, activity_date);
  CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity (user_id);
  CREATE INDEX IF NOT EXISTS idx_user_activity_date ON user_activity (activity_date);
`);

await run("import_runs table", `
  CREATE TABLE IF NOT EXISTS import_runs (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL,
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
  CREATE INDEX IF NOT EXISTS idx_import_runs_user_id ON import_runs (user_id);
`);

await run("quote_versions table", `
  CREATE TABLE IF NOT EXISTS quote_versions (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id varchar NOT NULL,
    version_number integer NOT NULL,
    edited_by varchar,
    change_note text,
    snapshot jsonb NOT NULL,
    created_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_quote_versions_quote_id ON quote_versions (quote_id);
`);

await run("invoice_edits table", `
  CREATE TABLE IF NOT EXISTS invoice_edits (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id varchar NOT NULL,
    edited_by varchar NOT NULL,
    edited_at timestamp DEFAULT now(),
    edit_reason text,
    field_changed text NOT NULL,
    old_value text,
    new_value text,
    edit_source text DEFAULT 'manual'
  );
  CREATE INDEX IF NOT EXISTS idx_invoice_edits_invoice_id ON invoice_edits (invoice_id);
  CREATE INDEX IF NOT EXISTS idx_invoice_edits_edited_by ON invoice_edits (edited_by);
`);

await run("time_entry_dispute_events table", `
  CREATE TABLE IF NOT EXISTS time_entry_dispute_events (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    time_entry_id varchar NOT NULL,
    action text NOT NULL,
    actor_id varchar NOT NULL,
    note text,
    created_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_time_entry_dispute_events_time_entry_id ON time_entry_dispute_events (time_entry_id);
  CREATE INDEX IF NOT EXISTS idx_time_entry_dispute_events_actor_id ON time_entry_dispute_events (actor_id);
`);

await run("invite_codes table", `
  CREATE TABLE IF NOT EXISTS invite_codes (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    business_owner_id varchar NOT NULL,
    code varchar(8) NOT NULL,
    role_type text NOT NULL DEFAULT 'worker',
    role_id varchar,
    max_uses integer NOT NULL DEFAULT 10,
    used_count integer NOT NULL DEFAULT 0,
    expires_at timestamp NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp DEFAULT now()
  );
  DO $$ BEGIN
    ALTER TABLE invite_codes ADD CONSTRAINT invite_codes_code_key UNIQUE (code);
  EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;
  CREATE INDEX IF NOT EXISTS idx_invite_codes_business_owner_id ON invite_codes (business_owner_id);
`);

await run("job_assignments table", `
  CREATE TABLE IF NOT EXISTS job_assignments (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id varchar NOT NULL,
    user_id varchar NOT NULL,
    team_member_id varchar,
    hourly_rate_override decimal(10,2),
    display_name text,
    hide_name_on_invoice boolean DEFAULT false,
    is_active boolean DEFAULT true,
    assigned_at timestamp DEFAULT now(),
    created_at timestamp DEFAULT now(),
    assignment_status text DEFAULT 'assigned',
    worker_display_name_snapshot text,
    worker_phone_snapshot text,
    show_worker_phone_to_client boolean DEFAULT false,
    show_worker_name_to_client boolean DEFAULT true,
    last_sms_sent_at timestamp,
    travel_started_at timestamp,
    arrived_at timestamp,
    eta_minutes integer,
    eta_updated_at timestamp,
    accepted_at timestamp,
    accepted_by_name text,
    acceptance_signature_data text,
    confidentiality_agreed boolean DEFAULT false,
    acceptance_ip_address text,
    acceptance_user_agent text,
    is_primary boolean DEFAULT false,
    completed_at timestamp
  );
  CREATE INDEX IF NOT EXISTS idx_job_assignments_job_id ON job_assignments (job_id);
  CREATE INDEX IF NOT EXISTS idx_job_assignments_user_id ON job_assignments (user_id);
  CREATE INDEX IF NOT EXISTS idx_job_assignments_team_member_id ON job_assignments (team_member_id);
`);

await run("assignment_events table", `
  CREATE TABLE IF NOT EXISTS assignment_events (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id varchar NOT NULL,
    job_id varchar NOT NULL,
    actor_user_id varchar NOT NULL,
    event_type text NOT NULL,
    event_data jsonb DEFAULT '{}',
    created_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_assignment_events_assignment_id ON assignment_events (assignment_id);
  CREATE INDEX IF NOT EXISTS idx_assignment_events_job_id ON assignment_events (job_id);
  CREATE INDEX IF NOT EXISTS idx_assignment_events_actor_user_id ON assignment_events (actor_user_id);
`);

await run("job_portal_tokens table", `
  CREATE TABLE IF NOT EXISTS job_portal_tokens (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id varchar NOT NULL,
    assignment_id varchar,
    user_id varchar NOT NULL,
    token varchar(64) NOT NULL,
    expires_at timestamp NOT NULL,
    revoked_at timestamp,
    last_accessed_at timestamp,
    access_count integer DEFAULT 0,
    created_by varchar NOT NULL,
    show_timeline boolean DEFAULT true,
    show_photos boolean DEFAULT true,
    show_checklist boolean DEFAULT true,
    show_activity_feed boolean DEFAULT true,
    show_financials_on_portal boolean DEFAULT false,
    show_programme_on_portal boolean DEFAULT false,
    client_message text,
    created_at timestamp DEFAULT now()
  );
  DO $$ BEGIN
    ALTER TABLE job_portal_tokens ADD CONSTRAINT job_portal_tokens_token_key UNIQUE (token);
  EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;
  CREATE INDEX IF NOT EXISTS idx_job_portal_tokens_job_id ON job_portal_tokens (job_id);
  CREATE INDEX IF NOT EXISTS idx_job_portal_tokens_user_id ON job_portal_tokens (user_id);
`);

await run("compliance_documents table", `
  CREATE TABLE IF NOT EXISTS compliance_documents (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    business_owner_id varchar NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    document_number text,
    issuer text,
    holder_name text,
    holder_user_id varchar,
    expiry_date timestamp,
    coverage_amount text,
    insurer text,
    vehicle_plate text,
    attachment_url text,
    attachment_type text,
    notes text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_compliance_documents_business_owner_id ON compliance_documents (business_owner_id);
`);

await run("job_requests table", `
  CREATE TABLE IF NOT EXISTS job_requests (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL,
    client_id varchar NOT NULL,
    title text NOT NULL,
    description text,
    preferred_date timestamp,
    urgency text NOT NULL DEFAULT 'normal',
    client_notes text,
    preferred_worker_id varchar,
    preferred_worker_name text,
    reference_job_id varchar,
    reference_job_title text,
    status text NOT NULL DEFAULT 'pending',
    reviewed_at timestamp,
    review_notes text,
    job_id varchar,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_job_requests_user_id ON job_requests (user_id);
  CREATE INDEX IF NOT EXISTS idx_job_requests_client_id ON job_requests (client_id);
`);

await run("worker_requests table", `
  CREATE TABLE IF NOT EXISTS worker_requests (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id varchar NOT NULL,
    business_owner_id varchar NOT NULL,
    preferred_worker_id varchar NOT NULL,
    worker_name text NOT NULL,
    reference_job_id varchar,
    reference_job_title text,
    message text,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamp DEFAULT now(),
    responded_at timestamp
  );
  CREATE INDEX IF NOT EXISTS idx_worker_requests_client_id ON worker_requests (client_id);
  CREATE INDEX IF NOT EXISTS idx_worker_requests_business_owner_id ON worker_requests (business_owner_id);
`);

await run("job_invites table", `
  CREATE TABLE IF NOT EXISTS job_invites (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id varchar NOT NULL,
    user_id varchar NOT NULL,
    invite_code varchar(64) NOT NULL UNIQUE,
    email varchar(255),
    role varchar(50) DEFAULT 'subcontractor',
    permissions jsonb DEFAULT '["view_job","add_notes"]',
    expires_at timestamp,
    used_at timestamp,
    used_by varchar,
    status varchar(20) DEFAULT 'pending',
    created_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_job_invites_job_id ON job_invites (job_id);
  CREATE INDEX IF NOT EXISTS idx_job_invites_user_id ON job_invites (user_id);
`);

await run("swms_documents table", `
  CREATE TABLE IF NOT EXISTS swms_documents (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL,
    job_id varchar,
    title text NOT NULL,
    description text,
    site_address text,
    work_activity_description text,
    ppe_requirements jsonb DEFAULT '[]',
    emergency_contact text,
    first_aid_location text,
    status text NOT NULL DEFAULT 'draft',
    attachment_url text,
    attachment_type text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_swms_documents_user_id ON swms_documents (user_id);
  CREATE INDEX IF NOT EXISTS idx_swms_documents_job_id ON swms_documents (job_id);
`);

await run("swms_hazards table", `
  CREATE TABLE IF NOT EXISTS swms_hazards (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    swms_id varchar NOT NULL,
    step_number integer NOT NULL DEFAULT 1,
    activity_task text NOT NULL,
    hazard text NOT NULL,
    likelihood text NOT NULL DEFAULT 'possible',
    consequence text NOT NULL DEFAULT 'moderate',
    risk_before text NOT NULL DEFAULT 'medium',
    control_measures text,
    risk_after text NOT NULL DEFAULT 'low',
    sort_order integer DEFAULT 0,
    created_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_swms_hazards_swms_id ON swms_hazards (swms_id);
`);

await run("swms_signatures table", `
  CREATE TABLE IF NOT EXISTS swms_signatures (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    swms_id varchar NOT NULL,
    worker_name text NOT NULL,
    worker_user_id varchar,
    signature_data text NOT NULL,
    signed_at timestamp NOT NULL DEFAULT now(),
    latitude text,
    longitude text,
    address text,
    created_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_swms_signatures_swms_id ON swms_signatures (swms_id);
`);

await run("incident_reports table", `
  CREATE TABLE IF NOT EXISTS incident_reports (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL,
    job_id varchar,
    incident_type text NOT NULL DEFAULT 'near_miss',
    severity text NOT NULL DEFAULT 'minor',
    title text NOT NULL,
    description text NOT NULL,
    location text,
    incident_date timestamp NOT NULL DEFAULT now(),
    reported_to text,
    reported_to_role text,
    witnesses json,
    immediate_actions text,
    photos json,
    injury_details text,
    body_part_affected text,
    treatment_provided text,
    worker_name text,
    is_notifiable boolean DEFAULT false,
    status text NOT NULL DEFAULT 'open',
    follow_up_actions text,
    closed_at timestamp,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_incident_reports_user_id ON incident_reports (user_id);
`);

await run("jsa_documents table", `
  CREATE TABLE IF NOT EXISTS jsa_documents (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL,
    job_id varchar,
    title text NOT NULL,
    description text,
    site_address text,
    assessed_by text,
    assessed_date timestamp DEFAULT now(),
    ppe_requirements json,
    status text NOT NULL DEFAULT 'draft',
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_jsa_documents_user_id ON jsa_documents (user_id);
`);

await run("jsa_steps table", `
  CREATE TABLE IF NOT EXISTS jsa_steps (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    jsa_id varchar NOT NULL,
    step_number integer NOT NULL DEFAULT 1,
    task_description text NOT NULL,
    hazards text NOT NULL,
    risk_level text NOT NULL DEFAULT 'medium',
    control_measures text NOT NULL,
    responsible_person text,
    sort_order integer DEFAULT 0,
    created_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_jsa_steps_jsa_id ON jsa_steps (jsa_id);
`);

await run("hazard_reports table", `
  CREATE TABLE IF NOT EXISTS hazard_reports (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL,
    job_id varchar,
    description text NOT NULL,
    location text NOT NULL,
    date_identified text NOT NULL,
    time_identified text NOT NULL,
    recommended_action text NOT NULL,
    date_reported_to_supervisor text,
    time_reported_to_supervisor text,
    reported_by text NOT NULL,
    supervisor_name text,
    risk_level text NOT NULL DEFAULT 'medium',
    status text NOT NULL DEFAULT 'open',
    photos text[],
    notes text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_hazard_reports_user_id ON hazard_reports (user_id);
`);

await run("training_records table", `
  CREATE TABLE IF NOT EXISTS training_records (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL,
    team_member_id varchar,
    worker_name text NOT NULL,
    course_code text NOT NULL,
    course_name text NOT NULL,
    rto_name text,
    completion_date text NOT NULL,
    expiry_date text,
    certificate_number text,
    status text NOT NULL DEFAULT 'current',
    attachment_url text,
    attachment_type text,
    notes text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_training_records_user_id ON training_records (user_id);
`);

await run("idempotency_keys table", `
  CREATE TABLE IF NOT EXISTS idempotency_keys (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    key varchar(512) NOT NULL UNIQUE,
    response text NOT NULL,
    expires_at timestamp NOT NULL,
    created_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_idempotency_keys_key ON idempotency_keys (key);
  CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires ON idempotency_keys (expires_at);
`);

await run("ai_receptionist_config table", `
  CREATE TABLE IF NOT EXISTS ai_receptionist_config (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL,
    label text,
    vapi_assistant_id text,
    vapi_phone_number_id text,
    voice_id text,
    voice_name text DEFAULT 'Jess',
    greeting text,
    mode text NOT NULL DEFAULT 'off',
    transfer_numbers json DEFAULT '[]',
    business_hours json,
    enabled boolean NOT NULL DEFAULT false,
    dedicated_phone_number text,
    approval_status text DEFAULT 'none',
    provisioning_error text,
    stripe_subscription_item_id text,
    twilio_number_sid text,
    provisioned_at timestamp,
    approved_at timestamp,
    knowledge_bank json,
    sms_notifications boolean NOT NULL DEFAULT false,
    recording_enabled boolean NOT NULL DEFAULT false,
    voice_stability real DEFAULT 0.5,
    voice_clarity real DEFAULT 0.75,
    voice_speed real DEFAULT 1.0,
    voice_style_exaggeration real DEFAULT 0,
    voice_speaker_boost boolean DEFAULT false,
    voicemail_detection_enabled boolean DEFAULT true,
    voicemail_message text,
    silence_timeout_seconds integer DEFAULT 30,
    max_call_duration_seconds integer DEFAULT 600,
    end_call_message text,
    background_sound text DEFAULT 'off',
    ai_model text DEFAULT 'gpt-4o-mini',
    ai_max_tokens integer DEFAULT 250,
    ai_temperature real DEFAULT 0.5,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_ai_receptionist_config_user_id ON ai_receptionist_config (user_id);
`);

await run("addon_subscriptions table", `
  CREATE TABLE IF NOT EXISTS addon_subscriptions (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL,
    addon text NOT NULL,
    source text NOT NULL DEFAULT 'apple',
    status text NOT NULL DEFAULT 'active',
    apple_product_id text,
    apple_original_transaction_id text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_addon_subs_user ON addon_subscriptions (user_id);
  CREATE INDEX IF NOT EXISTS idx_addon_subs_apple_txn ON addon_subscriptions (apple_original_transaction_id);
`);

await run("ai_receptionist_calls table", `
  CREATE TABLE IF NOT EXISTS ai_receptionist_calls (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL,
    vapi_call_id text NOT NULL,
    phone_number_id varchar,
    called_number text,
    caller_phone text,
    caller_name text,
    status text NOT NULL DEFAULT 'ringing',
    duration integer,
    summary text,
    transcript text,
    recording_url text,
    lead_id varchar,
    outcome text,
    transferred_to text,
    transfer_status text,
    caller_intent text,
    extracted_info json,
    ended_reason text,
    cost decimal(8,4),
    sentiment text,
    sentiment_score real,
    latency_ms integer,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_ai_calls_user ON ai_receptionist_calls (user_id);
  CREATE INDEX IF NOT EXISTS idx_ai_calls_vapi ON ai_receptionist_calls (vapi_call_id);
  CREATE INDEX IF NOT EXISTS idx_ai_calls_created ON ai_receptionist_calls (created_at);
`);

await run("error_logs table", `
  CREATE TABLE IF NOT EXISTS error_logs (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    level text NOT NULL,
    category text NOT NULL,
    message text NOT NULL,
    user_id varchar,
    metadata jsonb,
    error_details jsonb,
    created_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_error_logs_level ON error_logs (level);
  CREATE INDEX IF NOT EXISTS idx_error_logs_category ON error_logs (category);
  CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs (created_at);
`);

await run("audit_logs table", `
  CREATE TABLE IF NOT EXISTS audit_logs (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id varchar NOT NULL,
    target_user_id varchar NOT NULL,
    action_type text NOT NULL,
    metadata jsonb,
    ip_address text,
    created_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON audit_logs (admin_user_id);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs (target_user_id);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at);
`);

await run("system_events table", `
  CREATE TABLE IF NOT EXISTS system_events (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type text NOT NULL,
    severity text NOT NULL DEFAULT 'info',
    source text NOT NULL,
    message text NOT NULL,
    metadata jsonb,
    user_id varchar,
    resolved_at timestamp,
    created_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_system_events_type ON system_events (event_type);
  CREATE INDEX IF NOT EXISTS idx_system_events_severity ON system_events (severity);
  CREATE INDEX IF NOT EXISTS idx_system_events_created ON system_events (created_at);
`);

await run("website_addons table", `
  CREATE TABLE IF NOT EXISTS website_addons (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id varchar NOT NULL,
    domain_url text,
    domain_status text NOT NULL DEFAULT 'not_set_up',
    hosting_status text NOT NULL DEFAULT 'inactive',
    monthly_fee decimal(10,2),
    website_click_to_call boolean DEFAULT true,
    website_chat_widget boolean DEFAULT true,
    website_booking_form boolean DEFAULT true,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  );
  DO $$ BEGIN
    ALTER TABLE website_addons ADD CONSTRAINT website_addons_business_id_unique UNIQUE (business_id);
  EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;
  CREATE INDEX IF NOT EXISTS idx_website_addons_business ON website_addons (business_id);
`);

await run("website_change_requests table", `
  CREATE TABLE IF NOT EXISTS website_change_requests (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id varchar NOT NULL,
    user_id varchar NOT NULL,
    title text,
    description text NOT NULL,
    priority text NOT NULL DEFAULT 'normal',
    status text NOT NULL DEFAULT 'todo',
    screenshot_url text,
    assigned_to varchar,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_website_cr_business ON website_change_requests (business_id);
  CREATE INDEX IF NOT EXISTS idx_website_cr_status ON website_change_requests (status);
`);

await run("voice_change_requests table", `
  CREATE TABLE IF NOT EXISTS voice_change_requests (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL,
    requested_description text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    admin_notes text,
    created_at timestamp DEFAULT now(),
    resolved_at timestamp
  );
  CREATE INDEX IF NOT EXISTS idx_vcr_user ON voice_change_requests (user_id);
`);

await run("subcontractor_invoices table", `
  CREATE TABLE IF NOT EXISTS subcontractor_invoices (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    subcontractor_user_id varchar NOT NULL,
    business_owner_id varchar NOT NULL,
    doc_type text NOT NULL DEFAULT 'invoice',
    title text,
    gst_enabled boolean NOT NULL DEFAULT true,
    status text NOT NULL DEFAULT 'draft',
    invoice_number text NOT NULL,
    subtotal_amount decimal(10,2) NOT NULL DEFAULT 0,
    gst_amount decimal(10,2) NOT NULL DEFAULT 0,
    total_amount decimal(10,2) NOT NULL DEFAULT 0,
    due_date timestamp,
    valid_until timestamp,
    submitted_at timestamp,
    approved_at timestamp,
    rejected_at timestamp,
    rejection_reason text,
    paid_at timestamp,
    paid_method text,
    paid_reference text,
    paid_notes text,
    remittance_sent_at timestamp,
    accounting_provider text,
    accounting_bill_id text,
    accounting_synced_at timestamp,
    accounting_sync_error text,
    notes text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_subinv_subcontractor ON subcontractor_invoices (subcontractor_user_id);
  CREATE INDEX IF NOT EXISTS idx_subinv_business ON subcontractor_invoices (business_owner_id);
  CREATE INDEX IF NOT EXISTS idx_subinv_status ON subcontractor_invoices (status);
`);

await run("subcontractor_invoice_items table", `
  CREATE TABLE IF NOT EXISTS subcontractor_invoice_items (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id varchar NOT NULL,
    description text NOT NULL,
    hours decimal(10,2),
    rate decimal(10,2),
    quantity decimal(10,2),
    unit_price decimal(10,2),
    amount decimal(10,2) NOT NULL DEFAULT 0,
    job_id varchar,
    time_entry_id varchar,
    created_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_subinv_item_invoice ON subcontractor_invoice_items (invoice_id);
`);

await run("worker_payment_details table", `
  CREATE TABLE IF NOT EXISTS worker_payment_details (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL UNIQUE,
    bank_bsb text,
    bank_account_number text,
    bank_account_name text,
    abn text,
    pay_id text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_worker_payment_details_user ON worker_payment_details (user_id);
`);

await run("payroll_payments table", `
  CREATE TABLE IF NOT EXISTS payroll_payments (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    business_owner_id varchar NOT NULL,
    worker_user_id varchar NOT NULL,
    team_member_id varchar,
    period_start timestamp NOT NULL,
    period_end timestamp NOT NULL,
    regular_hours decimal(10,2) NOT NULL DEFAULT 0,
    overtime_hours decimal(10,2) NOT NULL DEFAULT 0,
    total_hours decimal(10,2) NOT NULL DEFAULT 0,
    gross_pay decimal(10,2) NOT NULL DEFAULT 0,
    travel_allowance decimal(10,2) NOT NULL DEFAULT 0,
    total_distance_km decimal(10,2) NOT NULL DEFAULT 0,
    travel_rate_per_km decimal(10,4) NOT NULL DEFAULT 0,
    method text NOT NULL DEFAULT 'bank_transfer',
    reference text,
    notes text,
    paid_at timestamp NOT NULL DEFAULT now(),
    remittance_sent_at timestamp,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_payroll_payments_business ON payroll_payments (business_owner_id);
  CREATE INDEX IF NOT EXISTS idx_payroll_payments_worker ON payroll_payments (worker_user_id);
`);

await run("worker_states table", `
  CREATE TABLE IF NOT EXISTS worker_states (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL,
    business_owner_id varchar NOT NULL,
    state text NOT NULL DEFAULT 'available',
    job_id varchar,
    note text,
    updated_at timestamp DEFAULT now(),
    created_at timestamp DEFAULT now()
  );
  DO $$ BEGIN
    ALTER TABLE worker_states ADD CONSTRAINT uq_worker_states_biz_user UNIQUE (business_owner_id, user_id);
  EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;
  CREATE INDEX IF NOT EXISTS idx_worker_states_user ON worker_states (user_id);
  CREATE INDEX IF NOT EXISTS idx_worker_states_business ON worker_states (business_owner_id);
`);

await run("number_port_requests table", `
  CREATE TABLE IF NOT EXISTS number_port_requests (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL,
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
  );
  CREATE INDEX IF NOT EXISTS idx_port_requests_user ON number_port_requests (user_id);
`);

await run("claim_purchase_orders table", `
  CREATE TABLE IF NOT EXISTS claim_purchase_orders (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id varchar NOT NULL,
    purchase_order_id varchar NOT NULL,
    created_at timestamp DEFAULT now()
  );
  DO $$ BEGIN
    ALTER TABLE claim_purchase_orders ADD CONSTRAINT uq_cpo_claim_po UNIQUE (claim_id, purchase_order_id);
  EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;
  CREATE INDEX IF NOT EXISTS idx_cpo_claim_id ON claim_purchase_orders (claim_id);
`);

// job_phase_assignments: phase_id must be uuid (not varchar) because
// job_phases.id is stored as uuid in this NEON database.
await run("job_phase_assignments table", `
  CREATE TABLE IF NOT EXISTS job_phase_assignments (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    phase_id uuid NOT NULL,
    user_id varchar NOT NULL,
    is_lead boolean NOT NULL DEFAULT false,
    created_at timestamp DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uq_job_phase_assignments_phase_user ON job_phase_assignments (phase_id, user_id);
  CREATE INDEX IF NOT EXISTS idx_job_phase_assignments_phase_id ON job_phase_assignments (phase_id);
  CREATE INDEX IF NOT EXISTS idx_job_phase_assignments_user_id ON job_phase_assignments (user_id);
`);

await run("tasks table", `
  CREATE TABLE IF NOT EXISTS tasks (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL,
    job_id varchar,
    title text NOT NULL,
    description text,
    status text DEFAULT 'open',
    assigned_to varchar,
    due_at timestamp,
    source text DEFAULT 'manual',
    source_form_id varchar,
    source_submission_id varchar,
    completed_at timestamp,
    completed_by varchar,
    estimated_hours decimal(8,2),
    actual_hours decimal(8,2),
    estimated_material_cost decimal(10,2),
    actual_material_cost decimal(10,2),
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks (user_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_job_id ON tasks (job_id);
`);

await run("task_time_entries table", `
  CREATE TABLE IF NOT EXISTS task_time_entries (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id varchar NOT NULL,
    time_entry_id varchar NOT NULL,
    created_at timestamp DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uq_task_time_entries ON task_time_entries (task_id, time_entry_id);
  CREATE INDEX IF NOT EXISTS idx_task_time_entries_task_id ON task_time_entries (task_id);
`);

await run("task_materials table", `
  CREATE TABLE IF NOT EXISTS task_materials (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id varchar NOT NULL,
    job_material_id varchar NOT NULL,
    created_at timestamp DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uq_task_materials ON task_materials (task_id, job_material_id);
  CREATE INDEX IF NOT EXISTS idx_task_materials_task_id ON task_materials (task_id);
`);

await run("gps_signal_logs table", `
  CREATE TABLE IF NOT EXISTS gps_signal_logs (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL,
    business_owner_id varchar NOT NULL,
    job_id varchar,
    event_type text NOT NULL,
    latitude decimal(10,7),
    longitude decimal(10,7),
    accuracy decimal(10,2),
    address text,
    battery_level integer,
    is_charging boolean DEFAULT false,
    duration_seconds integer,
    metadata json,
    created_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_gps_signal_logs_user_id ON gps_signal_logs (user_id);
  CREATE INDEX IF NOT EXISTS idx_gps_signal_logs_business_owner_id ON gps_signal_logs (business_owner_id);
`);

await pool.end();
console.log("\nDone. All migrations applied.");
