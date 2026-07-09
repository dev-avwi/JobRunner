---
name: Terminal payment-success ordering
description: How /api/terminal/payment-success stays retry-safe — side effects before marking succeeded, ledger reference as idempotency key.
---

Rule: in the tap-to-pay confirm endpoint, run all critical side effects (payment ledger entry + invoice amountPaid/status update) BEFORE flipping the terminal payment record to `succeeded`. Mark succeeded last; the `alreadyPaid` short-circuit only fires once everything completed.

**Why:** if the record is marked succeeded first and a later step throws, the client retry short-circuits as alreadyPaid and the invoice/ledger updates are lost forever.

**How to apply:**
- Idempotency key = payment_records.reference === paymentIntentId; if a record exists, skip ledger insert + amountPaid increment but still run the rest.
- Ledger + updateInvoice failures must NOT be swallowed (500 → retry re-runs); job status, payment-link cancel, notifications, automation, receipt stay best-effort try/catch.
- Payment links/requests are cancelled only on FULL payment (partial still owes the remainder) — deliberate decision.
- Demo bypass: only demo business + `demo_pi_` prefix skips Stripe verification; mobile terminal-location fetch is non-fatal (demo has no Connect → 400 → falls back to `tml_simulated`).
