import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.NEON_DATABASE_URL, max: 3 });
async function run(label: string, sql: string) {
  try { await pool.query(sql); console.log(`✓ ${label}`); }
  catch (err: any) { console.error(`✗ ${label}: ${err.message}`); }
}

// quickbooks_connections
await run("qb.refresh_token_expires_at", `ALTER TABLE quickbooks_connections ADD COLUMN IF NOT EXISTS refresh_token_expires_at timestamp`);
await run("qb.connected_at", `ALTER TABLE quickbooks_connections ADD COLUMN IF NOT EXISTS connected_at timestamp DEFAULT now()`);
await run("qb.last_sync_at", `ALTER TABLE quickbooks_connections ADD COLUMN IF NOT EXISTS last_sync_at timestamp`);
await run("qb.status", `ALTER TABLE quickbooks_connections ADD COLUMN IF NOT EXISTS status text DEFAULT 'active'`);

// job_equipment
await run("job_equipment.equipment_id", `ALTER TABLE job_equipment ADD COLUMN IF NOT EXISTS equipment_id varchar`);
await run("job_equipment.hours_used", `ALTER TABLE job_equipment ADD COLUMN IF NOT EXISTS hours_used decimal(10,2)`);
await run("job_equipment.km_travelled", `ALTER TABLE job_equipment ADD COLUMN IF NOT EXISTS km_travelled decimal(10,2)`);
await run("job_equipment.capacity_used", `ALTER TABLE job_equipment ADD COLUMN IF NOT EXISTS capacity_used decimal(10,2)`);
await run("job_equipment.capacity_available", `ALTER TABLE job_equipment ADD COLUMN IF NOT EXISTS capacity_available decimal(10,2)`);
await run("job_equipment.post_job_notes", `ALTER TABLE job_equipment ADD COLUMN IF NOT EXISTS post_job_notes text`);
await run("job_equipment.was_oversized", `ALTER TABLE job_equipment ADD COLUMN IF NOT EXISTS was_oversized boolean DEFAULT false`);
await run("job_equipment.completed_at", `ALTER TABLE job_equipment ADD COLUMN IF NOT EXISTS completed_at timestamp`);
await run("job_equipment.assigned_at", `ALTER TABLE job_equipment ADD COLUMN IF NOT EXISTS assigned_at timestamp DEFAULT now()`);

// sms_notification_log
await run("sms_log.job_id", `ALTER TABLE sms_notification_log ADD COLUMN IF NOT EXISTS job_id varchar`);
await run("sms_log.assignment_id", `ALTER TABLE sms_notification_log ADD COLUMN IF NOT EXISTS assignment_id varchar`);
await run("sms_log.client_phone", `ALTER TABLE sms_notification_log ADD COLUMN IF NOT EXISTS client_phone text`);
await run("sms_log.sms_message_id", `ALTER TABLE sms_notification_log ADD COLUMN IF NOT EXISTS sms_message_id varchar`);
await run("sms_log.portal_token_id", `ALTER TABLE sms_notification_log ADD COLUMN IF NOT EXISTS portal_token_id varchar`);
await run("sms_log.eta_minutes", `ALTER TABLE sms_notification_log ADD COLUMN IF NOT EXISTS eta_minutes integer`);

// location_pings
await run("location_pings.assignment_id", `ALTER TABLE location_pings ADD COLUMN IF NOT EXISTS assignment_id varchar`);
await run("location_pings.accuracy_meters", `ALTER TABLE location_pings ADD COLUMN IF NOT EXISTS accuracy_meters decimal(10,2)`);
await run("location_pings.recorded_at", `ALTER TABLE location_pings ADD COLUMN IF NOT EXISTS recorded_at timestamp DEFAULT now()`);

// subcontractor_tokens
await run("sub_tokens.invite_id", `ALTER TABLE subcontractor_tokens ADD COLUMN IF NOT EXISTS invite_id varchar`);
await run("sub_tokens.contact_phone", `ALTER TABLE subcontractor_tokens ADD COLUMN IF NOT EXISTS contact_phone text`);
await run("sub_tokens.contact_email", `ALTER TABLE subcontractor_tokens ADD COLUMN IF NOT EXISTS contact_email text`);
await run("sub_tokens.contact_name", `ALTER TABLE subcontractor_tokens ADD COLUMN IF NOT EXISTS contact_name text`);
await run("sub_tokens.permissions", `ALTER TABLE subcontractor_tokens ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '["view_job"]'`);
await run("sub_tokens.status", `ALTER TABLE subcontractor_tokens ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'`);
await run("sub_tokens.accepted_at", `ALTER TABLE subcontractor_tokens ADD COLUMN IF NOT EXISTS accepted_at timestamp`);
await run("sub_tokens.last_accessed_at", `ALTER TABLE subcontractor_tokens ADD COLUMN IF NOT EXISTS last_accessed_at timestamp`);
await run("sub_tokens.eta_minutes", `ALTER TABLE subcontractor_tokens ADD COLUMN IF NOT EXISTS eta_minutes integer`);
await run("sub_tokens.hourly_rate", `ALTER TABLE subcontractor_tokens ADD COLUMN IF NOT EXISTS hourly_rate decimal(10,2)`);
await run("sub_tokens.require_code", `ALTER TABLE subcontractor_tokens ADD COLUMN IF NOT EXISTS require_code boolean DEFAULT false`);
await run("sub_tokens.code_hash", `ALTER TABLE subcontractor_tokens ADD COLUMN IF NOT EXISTS code_hash text`);
await run("sub_tokens.code_attempts", `ALTER TABLE subcontractor_tokens ADD COLUMN IF NOT EXISTS code_attempts integer DEFAULT 0`);
await run("sub_tokens.code_issued_at", `ALTER TABLE subcontractor_tokens ADD COLUMN IF NOT EXISTS code_issued_at timestamp`);
await run("sub_tokens.name_confirmed_at", `ALTER TABLE subcontractor_tokens ADD COLUMN IF NOT EXISTS name_confirmed_at timestamp`);
await run("sub_tokens.last_opened_from_city", `ALTER TABLE subcontractor_tokens ADD COLUMN IF NOT EXISTS last_opened_from_city text`);
await run("sub_tokens.last_opened_from_ip", `ALTER TABLE subcontractor_tokens ADD COLUMN IF NOT EXISTS last_opened_from_ip text`);
await run("sub_tokens.open_count", `ALTER TABLE subcontractor_tokens ADD COLUMN IF NOT EXISTS open_count integer DEFAULT 0`);
await run("sub_tokens.revoked_reason", `ALTER TABLE subcontractor_tokens ADD COLUMN IF NOT EXISTS revoked_reason text`);
await run("sub_tokens.recipient_user_id", `ALTER TABLE subcontractor_tokens ADD COLUMN IF NOT EXISTS recipient_user_id varchar`);

// subcontractor_sessions
await run("sub_sessions.session_token", `ALTER TABLE subcontractor_sessions ADD COLUMN IF NOT EXISTS session_token varchar(64)`);
await run("sub_sessions.phone", `ALTER TABLE subcontractor_sessions ADD COLUMN IF NOT EXISTS phone text`);
await run("sub_sessions.expires_at", `ALTER TABLE subcontractor_sessions ADD COLUMN IF NOT EXISTS expires_at timestamp`);

// subcontractor_events
await run("sub_events.token_id", `ALTER TABLE subcontractor_events ADD COLUMN IF NOT EXISTS token_id varchar`);
await run("sub_events.latitude", `ALTER TABLE subcontractor_events ADD COLUMN IF NOT EXISTS latitude decimal(10,7)`);
await run("sub_events.longitude", `ALTER TABLE subcontractor_events ADD COLUMN IF NOT EXISTS longitude decimal(10,7)`);

// subcontractor_location_pings
await run("sub_loc.token_id", `ALTER TABLE subcontractor_location_pings ADD COLUMN IF NOT EXISTS token_id varchar`);
await run("sub_loc.accuracy_meters", `ALTER TABLE subcontractor_location_pings ADD COLUMN IF NOT EXISTS accuracy_meters decimal(10,2)`);
await run("sub_loc.recorded_at", `ALTER TABLE subcontractor_location_pings ADD COLUMN IF NOT EXISTS recorded_at timestamp DEFAULT now()`);

await pool.end();
console.log("\nDone.");
