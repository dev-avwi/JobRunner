-- Add cost_report_url to claims table so a generated PDF can be stored at submission time
ALTER TABLE claims ADD COLUMN IF NOT EXISTS cost_report_url TEXT;
