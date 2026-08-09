-- Task #91: accounting integrations parity round 2
-- New mapping ID columns + last-webhook timestamps on business_settings.
-- Idempotent ALTERs so this is safe to re-run if the columns were already
-- added by hand (which is how they were rolled out in dev).

ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS xero_sales_account_id varchar;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS xero_tax_rate_id varchar;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS xero_default_item_code varchar;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS xero_active_tenant_id varchar;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS xero_last_webhook_at timestamp;

ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS qbo_sales_account_id varchar;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS qbo_tax_rate_id varchar;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS qbo_default_item_id varchar;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS qbo_last_webhook_at timestamp;

ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS myob_income_account_id varchar;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS myob_tax_code_id varchar;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS myob_default_item_id varchar;
