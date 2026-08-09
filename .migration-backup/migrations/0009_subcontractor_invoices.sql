CREATE TABLE IF NOT EXISTS "subcontractor_invoices" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "invoice_number" varchar NOT NULL,
  "subcontractor_user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "business_owner_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" text DEFAULT 'draft' NOT NULL,
  "subtotal_amount" numeric(10,2) DEFAULT '0' NOT NULL,
  "gst_amount" numeric(10,2) DEFAULT '0' NOT NULL,
  "total_amount" numeric(10,2) DEFAULT '0' NOT NULL,
  "notes" text,
  "due_date" timestamp,
  "paid_at" timestamp,
  "paid_method" text,
  "submitted_at" timestamp,
  "approved_at" timestamp,
  "rejected_at" timestamp,
  "rejection_reason" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "subcontractor_invoice_items" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "invoice_id" varchar NOT NULL REFERENCES "subcontractor_invoices"("id") ON DELETE CASCADE,
  "description" text NOT NULL,
  "hours" numeric(10,2),
  "rate" numeric(10,2),
  "amount" numeric(10,2) DEFAULT '0' NOT NULL,
  "job_id" varchar,
  "time_entry_id" varchar,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_subinv_subcontractor" ON "subcontractor_invoices" ("subcontractor_user_id");
CREATE INDEX IF NOT EXISTS "idx_subinv_business_owner" ON "subcontractor_invoices" ("business_owner_id");
CREATE INDEX IF NOT EXISTS "idx_subinv_status" ON "subcontractor_invoices" ("status");
CREATE INDEX IF NOT EXISTS "idx_subinv_item_invoice" ON "subcontractor_invoice_items" ("invoice_id");
