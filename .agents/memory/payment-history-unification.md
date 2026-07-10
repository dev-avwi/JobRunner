---
name: Unified payment history (Tap to Pay + Links/QR)
description: How payment history merges terminal_payments with payment_requests, and why it's scoped by owner only.
---

Mobile Payment History (and any "all payments" view) should merge two sources via the `buildPaymentHistory(effectiveUserId, {includePaymentRequests})` helper in server/routes.ts:
- `terminal_payments` = Tap to Pay charges (method `tap_to_pay`), fee/net/settlement enriched from Stripe + cached in metadata.
- `payment_requests` with `status='paid'` = Payment Links AND QR codes (method `payment_link`). A QR is just a rendered version of the same link — there is NO stored link-vs-QR distinction, and NO fee/net tracking (they show gross).

Endpoints: `/api/terminal/payments` (includePaymentRequests:false, unchanged shape + additive `method` field) and `/api/payments/history` (includePaymentRequests:true). Both gated on MANAGE_PAYMENTS. Dedupe by stripePaymentIntentId (terminal first wins), sort newest-first.

**Why owner-only scoping (query by effectiveUserId), not team-wide:**
- `terminal_payments.userId` = business owner (created with termOwnerId). Owner-scoped.
- `payment_requests.userId` = the CREATOR (req.userId), and the table has NO businessOwnerId column. GET /api/payment-requests is likewise creator-scoped.
- A worker can belong to multiple businesses, so fetching payment_requests across team-member ids would pull that worker's links from OTHER tenants into this owner's history = cross-tenant leak. A bare direct link (no invoice/job/client) has nothing to re-verify ownership against.
- **Consequence:** a worker-created payment link won't appear in the owner's history. That's a pre-existing limitation of the creator-scoped payment_requests model, accepted deliberately over the leak risk. Fine for solo/owner-driven businesses (the common case). To fix properly you'd need a businessOwnerId column on payment_requests + a backfill (raw ALTER, never db:push on this DB).

**How to apply:** never widen the payment_requests read to team members without a real tenant column; keep effectiveUserId. When adding a new payment source, normalize it to the terminal shape inside the helper and add a `method` value + a mobile methodMeta() branch.
