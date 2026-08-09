---
name: Payment-confirm endpoints must verify with Stripe, never trust the client
description: Any route that flips a payment/invoice to paid must prove the charge with Stripe + scope ownership; demo bypass is gated on the receiving business being the demo account.
---

Any endpoint that marks a payment request, terminal payment, or invoice as **paid**
(and thus locks the invoice / fires "payment received" notifications) is a payment
trust boundary. It must NOT trust client-supplied signals.

**Rule:**
- For real payments, require `stripe.paymentIntents.retrieve(id).status === 'succeeded'`
  before any DB mutation. Also assert the stored intent id matches the supplied one,
  `pi.currency === 'aud'`, and the paid cents (`amount_received ?? amount`) equals the
  expected request amount (defense-in-depth against mis-association / amount drift).
- A "demo"/free bypass must be gated on the **receiving business owner** actually being
  the demo/visitor account (`storage.getUser(...).email` vs `DEMO_USER`/`VISITOR_USER`)
  AND a `demo_pi_*` id — never on a client-controlled flag like `paymentMethod:'demo'`.
- Enforce **ownership**: fetch the record first and reject if it isn't owned by the
  caller. Storage updates that mutate by intent id alone (e.g. `updateTerminalPaymentByIntent`
  WHERE stripePaymentIntentId only, no userId) leak across businesses — scope at the route
  by checking `record.userId === req.userId`.
- Add idempotency guards: already-paid returns success, cancelled returns 410.

**Why:** these endpoints were the source of truth for their flows (the subscription/checkout
Stripe webhook in `server/webhooks.ts` does NOT handle `payment_intent.succeeded` for the
public payment-request / terminal flows). A client could mark its own request+invoice paid
for free by posting a demo flag or by confirming a never-completed PI id.

**How to apply:** when auditing or adding any `/api/**/confirm-payment`,
`/api/terminal/payment-success`, or similar "mark paid" route, walk this checklist.
The public invoice `/:token/pay` path is create-intent only and is safe because it
confirms via the signed `/api/stripe/webhook/:uuid` (`payment_intent.succeeded` in
`server/webhookHandlers.ts`). The PayPal webhook is unsigned but logs-only (no state side
effects) — if state mutation is ever added there, it must be signed first.
