---
name: NDIS item codes + configurable numbering
description: Line-item item_code columns and simple sequential quote/invoice numbering — prod ALTERs pending, counter reservation pattern.
---

- **Prod ALTERs pending at next publish** (dev already applied; never db:push):
  - `ALTER TABLE quote_line_items ADD COLUMN IF NOT EXISTS item_code text;`
  - `ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS item_code text;`
  - `ALTER TABLE line_item_catalog ADD COLUMN IF NOT EXISTS item_code text;`
  - `ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS invoice_next_number integer;`
  - `ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS quote_next_number integer;`
- **Numbering contract**: if `invoiceNextNumber`/`quoteNextNumber` set (>0), numbers are `${prefix}${padded4}` simple sequential; null = classic year-based+random-suffix format. Numbers are globally UNIQUE across all users.
- **Why atomic reservation**: quotes/invoices number generation must reserve the counter with a single `UPDATE ... SET n = n + 1 ... RETURNING` (value used = returned − 1), never select-then-update — concurrent creates otherwise dup the number and the unique index 500s the insert. Collisions with pre-existing numbers burn a counter value and loop.
- **How to apply**: any new sequential counter (receipts, jobs, etc.) should copy this reservation pattern from `generateQuoteNumber`/`generateInvoiceNumber` in storage.ts, and invalidate the business-settings cache after the UPDATE.
- Item codes flow: catalog → editors → quote → convert/clone/bulk → invoice → preview + all 4 PDF renderers (escaped). Any NEW quote→invoice copy path must thread `itemCode` explicitly.
