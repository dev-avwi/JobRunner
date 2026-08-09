-- Add trade_type column to business_templates table for trade-specific templates
-- Templates with trade_type 'general' apply to all trades
-- Templates with specific trade types (plumbing, electrical, etc.) only apply to those businesses

ALTER TABLE business_templates 
ADD COLUMN IF NOT EXISTS trade_type TEXT DEFAULT 'general' NOT NULL;

-- Update existing templates to have 'general' trade type (already handled by default, but explicit)
UPDATE business_templates SET trade_type = 'general' WHERE trade_type IS NULL;

-- Create index for efficient querying by trade type
CREATE INDEX IF NOT EXISTS idx_business_templates_trade_type ON business_templates(trade_type);
CREATE INDEX IF NOT EXISTS idx_business_templates_user_family_trade ON business_templates(user_id, family, trade_type);
