---
name: Unified payment history (Tap to Pay + Links/QR + all methods)
description: How payment history merges terminal_payments with the receipts ledger, why receipts (not payment_requests) are the source, and the owner-scoping constraint.
---

Mobile Payment History (and any "all payments collected" view) is built by `buildPaymentHistory(effectiveUserId, {includeReceipts})` in server/routes.ts. Endpoints: `/api/terminal/payments` (includeReceipts:false, Tap to Pay only, unchanged shape + additive `method` field) and `/api/payments/history` (includeReceipts:true). Both requireAuth + MANAGE_PAYMENTS, scoped to effectiveUserId (owner).

**The receipts ledger is the source of truth for money collected — NOT payment_requests.** This was a real bug: folding in `payment_requests` where `status='paid'` showed nothing, because a completed Payment Link/QR records a row in the `receipts` table and the payment_request row often never flips to 'paid'. Do not filter payment history on payment_requests status.

Data model:
- `terminal_payments` = Tap to Pay charges only; carries Stripe fee/net/settlement (enriched + cached in metadata).
- `receipts` = authoritative record of EVERY collected payment. `paymentMethod` ∈ card, tap_to_pay, bank_transfer, cash, qr_code. `paymentReference` = the Stripe PaymentIntent id. `paymentRequestId` links back to a Payment Link/QR when applicable. Fee/net are NOT tracked on receipts (they show gross).
- A Tap to Pay charge exists as BOTH a terminal_payments row AND a receipt (paymentMethod 'tap_to_pay', paymentReference=PI).

Merge rules in the helper:
- Push terminal rows FIRST (method 'tap_to_pay', with fee/net), then append all receipts normalized to the terminal shape (stripePaymentIntentId = receipt.paymentReference, status 'succeeded', fee/net null, method = paymentMethod remapped to 'payment_link' when non-tap/non-qr and it has a paymentRequestId).
- Dedupe by PaymentIntent id into a Map: terminal wins when both succeeded (keeps fee/net), but a **succeeded** row always beats a stale pending/failed one for the same PI. Rows with null paymentReference (cash/manual) are never deduped away.
- Cancelled/incomplete links never create a receipt, so they correctly never appear — this is the answer to "why don't my cancelled ones show up".

Mobile methodMeta()/cardLabel() handle tap_to_pay/payment_link/qr_code/card/cash/bank_transfer. The "Net after fees" summary card only renders when at least one row actually has a fee (else it just duplicates "Collected").

**Owner-scoping constraint (deliberate):** receipts and payment_requests are created under the CREATING user's id (`req.userId` / `request.userId`), not the business owner, and neither table has a businessOwnerId column. History queries by owner effectiveUserId, so a link/receipt created by a non-owner team member won't appear in the owner's history. Accepted over the alternatives: writing under effectiveUserId breaks the existing worker-scoped `/api/receipts` + `/api/payment-requests` screens (they read by req.userId), and a business-wide read by member ids would leak a multi-business worker's rows across tenants. Fine for solo/owner-driven businesses (the common case). A proper fix needs a businessOwnerId column + backfill (raw ALTER, never db:push on this DB).

**How to apply:** when adding a new payment source, prefer the receipts ledger as the base for "collected" views; normalize to the terminal shape and add a `method` value + a mobile methodMeta() branch. Never widen the receipts/payment_requests read to team members without a real tenant column.
