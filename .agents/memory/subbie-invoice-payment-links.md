---
name: Subbie invoice card payment links
description: How subcontractor→owner invoice card links work and the invariants to keep
---

Subbie invoices reuse the generic payment_requests /pay/:token flow via `payment_requests.subcontractor_invoice_id`.

Rules:
- **Payout safety**: create-payment-intent must REFUSE (409) a subbie-linked request when the requester's Stripe Connect is missing/charges-disabled — never fall back to a platform charge the subbie won't receive.
- **Atomic paid flip**: confirm-payment flips status with a conditional `UPDATE ... WHERE status='pending' RETURNING`; abort on 0 rows (manual mark-paid may have cancelled it concurrently).
- **Cancel everywhere**: any terminal invoice state (manual paid, /pay route, rejected, delete) must cancel pending payment_requests for that invoice.
- Toggle UI shows only when the SUBBIE's own /api/stripe-connect/status is connected+chargesEnabled (status route uses req.userId = subbie's own settings, correct).
- Public pay page falls back to requester personal name when businessName is empty/'Worker Profile'.
- getBusinessSettings has a 60s cache — DB patches to connect fields need cache expiry/restart before taking effect.

**Prod at next publish**: raw `ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS subcontractor_invoice_id varchar;` (never db:push).

- 2026-07-23: invoice eligibility now accepts jobs.assignedTo === userId OR a job_assignments row (plain /assign never creates job_assignments); both create paths in server/routes.ts.
