-- Task #194 — Subbie-Bills-Business Billing Builder
-- ADDITIVE ONLY. Safe to run on production with zero downtime / no data loss.
-- Lets a subcontractor build a quote OR invoice (with qty/unit-price line items)
-- against a business they joined. Existing rows get safe defaults; legacy items
-- keep using hours/rate (reads + PDF fall back quantity/unit_price -> hours/rate).
--
-- Idempotent: uses ADD COLUMN IF NOT EXISTS so it can be re-run safely.

ALTER TABLE subcontractor_invoices  ADD COLUMN IF NOT EXISTS doc_type    text NOT NULL DEFAULT 'invoice';
ALTER TABLE subcontractor_invoices  ADD COLUMN IF NOT EXISTS title       text;
ALTER TABLE subcontractor_invoices  ADD COLUMN IF NOT EXISTS gst_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE subcontractor_invoices  ADD COLUMN IF NOT EXISTS valid_until timestamp;

ALTER TABLE subcontractor_invoice_items ADD COLUMN IF NOT EXISTS quantity   numeric(10,2);
ALTER TABLE subcontractor_invoice_items ADD COLUMN IF NOT EXISTS unit_price numeric(10,2);
