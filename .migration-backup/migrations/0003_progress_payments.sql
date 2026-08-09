-- Progress Payments & Deposit Workflow
-- Add payment_milestones column to invoices for defining payment stages
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_milestones JSONB;

-- Create payment_records table for tracking partial/progress payments
CREATE TABLE IF NOT EXISTS payment_records (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id VARCHAR NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  method TEXT NOT NULL DEFAULT 'cash',
  reference TEXT,
  note TEXT,
  recorded_by VARCHAR,
  paid_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_payment_records_invoice ON payment_records(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_user ON payment_records(user_id);
