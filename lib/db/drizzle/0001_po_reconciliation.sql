-- Migration: add purchase-order reconciliation columns
-- Adds the business-settings gate toggle and the PO sent-at timestamp.
-- Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE "business_settings"
  ADD COLUMN IF NOT EXISTS "require_po_reconciliation" boolean DEFAULT false;--> statement-breakpoint

ALTER TABLE "purchase_orders"
  ADD COLUMN IF NOT EXISTS "sent_at" timestamp;
