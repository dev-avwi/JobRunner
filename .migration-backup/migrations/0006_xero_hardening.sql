-- Add Xero contact linkage columns to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS xero_contact_id varchar;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS xero_synced_at timestamp;

-- Add audit trail columns to xero_sync_state table
ALTER TABLE xero_sync_state ADD COLUMN IF NOT EXISTS outcome varchar(20);
ALTER TABLE xero_sync_state ADD COLUMN IF NOT EXISTS records_processed integer DEFAULT 0;
ALTER TABLE xero_sync_state ADD COLUMN IF NOT EXISTS records_failed integer DEFAULT 0;
ALTER TABLE xero_sync_state ADD COLUMN IF NOT EXISTS duration_ms integer;
ALTER TABLE xero_sync_state ADD COLUMN IF NOT EXISTS error_details text;
ALTER TABLE xero_sync_state ADD COLUMN IF NOT EXISTS started_at timestamp DEFAULT now();
