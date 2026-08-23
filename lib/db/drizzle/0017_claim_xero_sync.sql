-- xero_sync_error: tracks last push failure message; NULL = no error or never attempted
ALTER TABLE claims ADD COLUMN IF NOT EXISTS xero_sync_error text;

-- claim_purchase_orders: POs explicitly attributed to a claim period (many-to-many join)
-- claims.id and purchase_orders.id are both uuid in this schema
CREATE TABLE IF NOT EXISTS claim_purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  purchase_order_id varchar NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT now(),
  CONSTRAINT uq_cpo_claim_po UNIQUE(claim_id, purchase_order_id)
);

CREATE INDEX IF NOT EXISTS idx_cpo_claim_id ON claim_purchase_orders(claim_id);
