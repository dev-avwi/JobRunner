-- Migration: progress claims with schedule of values
-- Adds claims and claim_line_items tables for construction/engineering billing.
-- Safe to run multiple times (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS "claims" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "job_id" varchar NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "claim_number" text NOT NULL,
  "status" text NOT NULL DEFAULT 'draft',
  "claim_date" timestamp DEFAULT now(),
  "period_start" date,
  "period_end" date,
  "subtotal" decimal(12,2) NOT NULL DEFAULT '0.00',
  "gst_amount" decimal(12,2) NOT NULL DEFAULT '0.00',
  "total" decimal(12,2) NOT NULL DEFAULT '0.00',
  "retention_percent" decimal(5,2) DEFAULT '0.00',
  "retention_amount" decimal(12,2) DEFAULT '0.00',
  "notes" text,
  "xero_invoice_id" varchar,
  "xero_synced_at" timestamp,
  "submitted_at" timestamp,
  "approved_at" timestamp,
  "paid_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_claims_job_id" ON "claims" ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_claims_user_id" ON "claims" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_claims_status" ON "claims" ("status");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "claim_line_items" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "claim_id" varchar NOT NULL REFERENCES "claims"("id") ON DELETE CASCADE,
  -- phase_id references job_phases(id) which is UUID in the live DB
  "phase_id" uuid REFERENCES "job_phases"("id") ON DELETE SET NULL,
  "description" text NOT NULL,
  "contract_value" decimal(12,2) NOT NULL DEFAULT '0.00',
  "previously_claimed" decimal(12,2) NOT NULL DEFAULT '0.00',
  "this_claim" decimal(12,2) NOT NULL DEFAULT '0.00',
  "retention_percent" decimal(5,2) DEFAULT '0.00',
  "sort_order" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_claim_line_items_claim_id" ON "claim_line_items" ("claim_id");
