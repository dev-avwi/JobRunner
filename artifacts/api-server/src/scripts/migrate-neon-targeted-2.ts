/**
 * Second-pass targeted migration against NEON_DATABASE_URL.
 * Covers all remaining drift detected after the first migration.
 */
import pg from "pg";

const dbUrl = process.env.NEON_DATABASE_URL;
if (!dbUrl) { console.error("NEON_DATABASE_URL is not set"); process.exit(1); }

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

// ── Missing columns on existing tables ─────────────────────────────────────────

// custom_forms
await run("custom_forms.is_job_card", `ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS is_job_card boolean DEFAULT false`);
await run("custom_forms.block_job_completion", `ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS block_job_completion boolean DEFAULT false`);
await run("custom_forms.task_rules", `ALTER TABLE custom_forms ADD COLUMN IF NOT EXISTS task_rules json DEFAULT '[]'`);

// digital_signatures
await run("digital_signatures.assignment_id", `ALTER TABLE digital_signatures ADD COLUMN IF NOT EXISTS assignment_id varchar`);

// email_delivery_logs
await run("email_delivery_logs.clicked_at", `ALTER TABLE email_delivery_logs ADD COLUMN IF NOT EXISTS clicked_at timestamp`);
await run("email_delivery_logs.bounced_at", `ALTER TABLE email_delivery_logs ADD COLUMN IF NOT EXISTS bounced_at timestamp`);
await run("email_delivery_logs.bounce_reason", `ALTER TABLE email_delivery_logs ADD COLUMN IF NOT EXISTS bounce_reason text`);
await run("email_delivery_logs.last_event_type", `ALTER TABLE email_delivery_logs ADD COLUMN IF NOT EXISTS last_event_type text`);
await run("email_delivery_logs.last_event_at", `ALTER TABLE email_delivery_logs ADD COLUMN IF NOT EXISTS last_event_at timestamp`);
await run("email_delivery_logs.open_count", `ALTER TABLE email_delivery_logs ADD COLUMN IF NOT EXISTS open_count integer DEFAULT 0`);
await run("email_delivery_logs.click_count", `ALTER TABLE email_delivery_logs ADD COLUMN IF NOT EXISTS click_count integer DEFAULT 0`);
await run("email_delivery_logs.retry_count", `ALTER TABLE email_delivery_logs ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0`);
await run("email_delivery_logs.max_retries", `ALTER TABLE email_delivery_logs ADD COLUMN IF NOT EXISTS max_retries integer DEFAULT 5`);
await run("email_delivery_logs.next_retry_at", `ALTER TABLE email_delivery_logs ADD COLUMN IF NOT EXISTS next_retry_at timestamp`);
await run("email_delivery_logs.permanently_failed", `ALTER TABLE email_delivery_logs ADD COLUMN IF NOT EXISTS permanently_failed boolean DEFAULT false`);
await run("email_delivery_logs.payload_json", `ALTER TABLE email_delivery_logs ADD COLUMN IF NOT EXISTS payload_json jsonb`);

// job_photos
await run("job_photos.latitude", `ALTER TABLE job_photos ADD COLUMN IF NOT EXISTS latitude double precision`);
await run("job_photos.longitude", `ALTER TABLE job_photos ADD COLUMN IF NOT EXISTS longitude double precision`);
await run("job_photos.address", `ALTER TABLE job_photos ADD COLUMN IF NOT EXISTS address text`);
await run("job_photos.tags", `ALTER TABLE job_photos ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[]`);
await run("job_photos.ai_suggested_category", `ALTER TABLE job_photos ADD COLUMN IF NOT EXISTS ai_suggested_category text`);

// voice_notes
await run("voice_notes.summary", `ALTER TABLE voice_notes ADD COLUMN IF NOT EXISTS summary text`);
await run("voice_notes.detected_actions", `ALTER TABLE voice_notes ADD COLUMN IF NOT EXISTS detected_actions jsonb`);

// job_variations
await run("job_variations.approval_method", `ALTER TABLE job_variations ADD COLUMN IF NOT EXISTS approval_method text`);
await run("job_variations.approval_contact", `ALTER TABLE job_variations ADD COLUMN IF NOT EXISTS approval_contact text`);

// sms_conversations
await run("sms_conversations.routing_state", `ALTER TABLE sms_conversations ADD COLUMN IF NOT EXISTS routing_state text DEFAULT 'resolved'`);
await run("sms_conversations.pending_options", `ALTER TABLE sms_conversations ADD COLUMN IF NOT EXISTS pending_options jsonb DEFAULT '[]'`);
await run("sms_conversations.last_routing_prompt_at", `ALTER TABLE sms_conversations ADD COLUMN IF NOT EXISTS last_routing_prompt_at timestamp`);

// xero_sync_state
await run("xero_sync_state.outcome", `ALTER TABLE xero_sync_state ADD COLUMN IF NOT EXISTS outcome varchar`);
await run("xero_sync_state.records_processed", `ALTER TABLE xero_sync_state ADD COLUMN IF NOT EXISTS records_processed integer DEFAULT 0`);
await run("xero_sync_state.records_failed", `ALTER TABLE xero_sync_state ADD COLUMN IF NOT EXISTS records_failed integer DEFAULT 0`);
await run("xero_sync_state.duration_ms", `ALTER TABLE xero_sync_state ADD COLUMN IF NOT EXISTS duration_ms integer`);
await run("xero_sync_state.error_details", `ALTER TABLE xero_sync_state ADD COLUMN IF NOT EXISTS error_details text`);
await run("xero_sync_state.started_at", `ALTER TABLE xero_sync_state ADD COLUMN IF NOT EXISTS started_at timestamp`);

// job_materials
await run("job_materials.unit_price", `ALTER TABLE job_materials ADD COLUMN IF NOT EXISTS unit_price decimal(10,2)`);
await run("job_materials.total_price", `ALTER TABLE job_materials ADD COLUMN IF NOT EXISTS total_price decimal(10,2)`);
await run("job_materials.markup_percent", `ALTER TABLE job_materials ADD COLUMN IF NOT EXISTS markup_percent decimal(10,2)`);
await run("job_materials.receipt_photo_url", `ALTER TABLE job_materials ADD COLUMN IF NOT EXISTS receipt_photo_url text`);

// automation_settings
await run("automation_settings.quote_follow_up_message", `ALTER TABLE automation_settings ADD COLUMN IF NOT EXISTS quote_follow_up_message text`);
await run("automation_settings.job_reminder_message", `ALTER TABLE automation_settings ADD COLUMN IF NOT EXISTS job_reminder_message text`);
await run("automation_settings.invoice_reminder_message", `ALTER TABLE automation_settings ADD COLUMN IF NOT EXISTS invoice_reminder_message text`);
await run("automation_settings.review_request_message", `ALTER TABLE automation_settings ADD COLUMN IF NOT EXISTS review_request_message text`);
await run("automation_settings.auto_invoice_on_complete", `ALTER TABLE automation_settings ADD COLUMN IF NOT EXISTS auto_invoice_on_complete boolean DEFAULT false`);
await run("automation_settings.auto_review_request", `ALTER TABLE automation_settings ADD COLUMN IF NOT EXISTS auto_review_request boolean DEFAULT false`);
await run("automation_settings.auto_review_request_type", `ALTER TABLE automation_settings ADD COLUMN IF NOT EXISTS auto_review_request_type text DEFAULT 'sms'`);
await run("automation_settings.photo_requirements_enabled", `ALTER TABLE automation_settings ADD COLUMN IF NOT EXISTS photo_requirements_enabled boolean DEFAULT false`);
await run("automation_settings.gps_auto_check_in_enabled", `ALTER TABLE automation_settings ADD COLUMN IF NOT EXISTS gps_auto_check_in_enabled boolean DEFAULT false`);
await run("automation_settings.technician_en_route_enabled", `ALTER TABLE automation_settings ADD COLUMN IF NOT EXISTS technician_en_route_enabled boolean DEFAULT false`);
await run("automation_settings.technician_en_route_channel", `ALTER TABLE automation_settings ADD COLUMN IF NOT EXISTS technician_en_route_channel text DEFAULT 'sms'`);

// ai_receptionist_config remaining columns
await run("ai_receptionist_config.custom_instructions", `ALTER TABLE ai_receptionist_config ADD COLUMN IF NOT EXISTS custom_instructions text`);
await run("ai_receptionist_config.auto_reply_enabled", `ALTER TABLE ai_receptionist_config ADD COLUMN IF NOT EXISTS auto_reply_enabled boolean NOT NULL DEFAULT true`);
await run("ai_receptionist_config.auto_reply_message", `ALTER TABLE ai_receptionist_config ADD COLUMN IF NOT EXISTS auto_reply_message text`);
await run("ai_receptionist_config.last_latency_ms", `ALTER TABLE ai_receptionist_config ADD COLUMN IF NOT EXISTS last_latency_ms integer`);
await run("ai_receptionist_config.last_latency_checked_at", `ALTER TABLE ai_receptionist_config ADD COLUMN IF NOT EXISTS last_latency_checked_at timestamp`);
await run("ai_receptionist_config.latency_status", `ALTER TABLE ai_receptionist_config ADD COLUMN IF NOT EXISTS latency_status text`);

// ── Missing TABLES ──────────────────────────────────────────────────────────────

await run("form_submission_versions table", `
  CREATE TABLE IF NOT EXISTS form_submission_versions (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id varchar NOT NULL,
    version_number integer NOT NULL DEFAULT 1,
    submission_data json DEFAULT '{}',
    edited_by varchar,
    edited_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_form_submission_versions_submission_id ON form_submission_versions (submission_id);
`);

await run("quick_replies table", `
  CREATE TABLE IF NOT EXISTS quick_replies (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL,
    label varchar(60) NOT NULL,
    body text NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_quick_replies_user_id ON quick_replies (user_id);
`);

await run("quickbooks_connections table", `
  CREATE TABLE IF NOT EXISTS quickbooks_connections (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL,
    realm_id varchar NOT NULL,
    company_name varchar,
    access_token text NOT NULL,
    refresh_token text NOT NULL,
    token_expires_at timestamp NOT NULL,
    scope text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uq_quickbooks_user_id ON quickbooks_connections (user_id);
  CREATE INDEX IF NOT EXISTS idx_quickbooks_connections_user_id ON quickbooks_connections (user_id);
`);

await run("job_equipment table", `
  CREATE TABLE IF NOT EXISTS job_equipment (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id varchar NOT NULL,
    user_id varchar NOT NULL,
    name text NOT NULL,
    description text,
    quantity integer NOT NULL DEFAULT 1,
    unit text,
    serial_number text,
    status text NOT NULL DEFAULT 'assigned',
    assigned_to varchar,
    checked_out_at timestamp,
    checked_in_at timestamp,
    notes text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_job_equipment_job_id ON job_equipment (job_id);
  CREATE INDEX IF NOT EXISTS idx_job_equipment_user_id ON job_equipment (user_id);
`);

await run("sms_notification_log table", `
  CREATE TABLE IF NOT EXISTS sms_notification_log (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL,
    recipient_phone text NOT NULL,
    message_body text NOT NULL,
    twilio_sid text,
    status text NOT NULL DEFAULT 'queued',
    error_code text,
    error_message text,
    notification_type text NOT NULL DEFAULT 'general',
    related_entity_type text,
    related_entity_id varchar,
    sent_at timestamp,
    created_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_sms_notification_log_user_id ON sms_notification_log (user_id);
  CREATE INDEX IF NOT EXISTS idx_sms_notification_log_type ON sms_notification_log (notification_type);
`);

await run("location_pings table", `
  CREATE TABLE IF NOT EXISTS location_pings (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL,
    business_owner_id varchar NOT NULL,
    job_id varchar,
    latitude decimal(10,7) NOT NULL,
    longitude decimal(10,7) NOT NULL,
    accuracy decimal(10,2),
    address text,
    battery_level integer,
    is_charging boolean DEFAULT false,
    speed decimal(6,2),
    heading decimal(6,2),
    altitude decimal(8,2),
    created_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_location_pings_user_id ON location_pings (user_id);
  CREATE INDEX IF NOT EXISTS idx_location_pings_business_owner_id ON location_pings (business_owner_id);
  CREATE INDEX IF NOT EXISTS idx_location_pings_created_at ON location_pings (created_at);
`);

await run("subcontractor_tokens table", `
  CREATE TABLE IF NOT EXISTS subcontractor_tokens (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL,
    job_id varchar NOT NULL,
    token varchar(64) NOT NULL UNIQUE,
    expires_at timestamp NOT NULL,
    revoked_at timestamp,
    created_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_subcontractor_tokens_user_id ON subcontractor_tokens (user_id);
  CREATE INDEX IF NOT EXISTS idx_subcontractor_tokens_job_id ON subcontractor_tokens (job_id);
`);

await run("subcontractor_sessions table", `
  CREATE TABLE IF NOT EXISTS subcontractor_sessions (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    token_id varchar NOT NULL,
    user_id varchar NOT NULL,
    job_id varchar NOT NULL,
    ip_address text,
    user_agent text,
    last_active_at timestamp DEFAULT now(),
    created_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_subcontractor_sessions_token_id ON subcontractor_sessions (token_id);
  CREATE INDEX IF NOT EXISTS idx_subcontractor_sessions_user_id ON subcontractor_sessions (user_id);
`);

await run("subcontractor_events table", `
  CREATE TABLE IF NOT EXISTS subcontractor_events (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL,
    job_id varchar NOT NULL,
    event_type text NOT NULL,
    event_data jsonb DEFAULT '{}',
    created_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_subcontractor_events_user_id ON subcontractor_events (user_id);
  CREATE INDEX IF NOT EXISTS idx_subcontractor_events_job_id ON subcontractor_events (job_id);
`);

await run("subcontractor_location_pings table", `
  CREATE TABLE IF NOT EXISTS subcontractor_location_pings (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL,
    job_id varchar NOT NULL,
    latitude decimal(10,7) NOT NULL,
    longitude decimal(10,7) NOT NULL,
    accuracy decimal(10,2),
    address text,
    battery_level integer,
    is_charging boolean DEFAULT false,
    created_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_subcontractor_location_pings_user_id ON subcontractor_location_pings (user_id);
  CREATE INDEX IF NOT EXISTS idx_subcontractor_location_pings_job_id ON subcontractor_location_pings (job_id);
`);

await run("saved_filters table", `
  CREATE TABLE IF NOT EXISTS saved_filters (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL,
    name text NOT NULL,
    filters jsonb NOT NULL,
    entity_type text NOT NULL DEFAULT 'jobs',
    created_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_saved_filters_user_id ON saved_filters (user_id);
`);

await run("payment_records table", `
  CREATE TABLE IF NOT EXISTS payment_records (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id varchar NOT NULL,
    user_id varchar NOT NULL,
    amount decimal(10,2) NOT NULL,
    method text NOT NULL DEFAULT 'cash',
    reference text,
    note text,
    recorded_by varchar,
    paid_at timestamp DEFAULT now(),
    created_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_payment_records_invoice_id ON payment_records (invoice_id);
  CREATE INDEX IF NOT EXISTS idx_payment_records_user_id ON payment_records (user_id);
`);

await run("site_emergency_info table", `
  CREATE TABLE IF NOT EXISTS site_emergency_info (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL,
    job_id varchar,
    site_name text,
    site_address text,
    assembly_point text,
    first_aid_location text,
    first_aid_officer text,
    first_aid_officer_phone text,
    emergency_number text DEFAULT '000',
    nearest_hospital text,
    nearest_hospital_address text,
    fire_equipment_locations json,
    evacuation_routes text,
    site_specific_hazards json,
    additional_contacts json,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_site_emergency_info_user_id ON site_emergency_info (user_id);
  CREATE INDEX IF NOT EXISTS idx_site_emergency_info_job_id ON site_emergency_info (job_id);
`);

await run("site_hazardous_environments table", `
  CREATE TABLE IF NOT EXISTS site_hazardous_environments (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL,
    job_id varchar,
    environment_type text NOT NULL,
    hazards json,
    control_measures json,
    required_ppe json,
    required_licenses json,
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_site_hazardous_user_id ON site_hazardous_environments (user_id);
`);

await run("site_safety_signage table", `
  CREATE TABLE IF NOT EXISTS site_safety_signage (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL,
    job_id varchar,
    sign_type text NOT NULL,
    sign_category text NOT NULL,
    location text,
    description text,
    is_required boolean DEFAULT true,
    is_installed boolean DEFAULT false,
    installed_date timestamp,
    photo_url text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_site_safety_signage_user_id ON site_safety_signage (user_id);
`);

await run("ppe_checklists table", `
  CREATE TABLE IF NOT EXISTS ppe_checklists (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL,
    job_id varchar,
    worker_name text NOT NULL,
    date text NOT NULL,
    hard_hat boolean NOT NULL DEFAULT false,
    hi_vis boolean NOT NULL DEFAULT false,
    safety_boots boolean NOT NULL DEFAULT false,
    safety_glasses boolean NOT NULL DEFAULT false,
    hearing_protection boolean NOT NULL DEFAULT false,
    gloves boolean NOT NULL DEFAULT false,
    sunscreen boolean NOT NULL DEFAULT false,
    respirator boolean NOT NULL DEFAULT false,
    safety_harness boolean NOT NULL DEFAULT false,
    other_ppe text,
    all_correct boolean NOT NULL DEFAULT false,
    supervisor_name text,
    notes text,
    created_at timestamp DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_ppe_checklists_user_id ON ppe_checklists (user_id);
`);

await run("rate_limits table", `
  CREATE TABLE IF NOT EXISTS rate_limits (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    key varchar(512) NOT NULL,
    count integer NOT NULL DEFAULT 1,
    window_start timestamp NOT NULL DEFAULT now(),
    expires_at timestamp NOT NULL
  );
  DO $$ BEGIN
    ALTER TABLE rate_limits ADD CONSTRAINT rate_limits_key_unique UNIQUE (key);
  EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;
  CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits (key);
  CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits (expires_at);
`);

await pool.end();
console.log("\nDone. All second-pass migrations applied.");
