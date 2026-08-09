---
name: business-settings worker sanitization
description: Why GET /api/business-settings must allowlist fields for non-owners, never spread the raw owner row.
---

# Non-owners must never receive the raw `business_settings` row

When a worker/subcontractor is operating inside a business they don't own, `GET /api/business-settings` swaps to the **owner's** settings so they see the business identity (name, logo) and inherit its plan. That swap must return a **non-sensitive DISPLAY allowlist only** — never `...displaySettings`.

**Why:** the `business_settings` table holds secrets and financial PII in the same row as branding: `twilioAuthToken`/`twilioAccountSid`, `googleCalendar*`/`outlook*` OAuth access+refresh tokens, `bankBsb`/`bankAccountNumber`, `stripeCustomerId`/`stripeSubscriptionId`/`stripeConnectAccountId`, `paymentMethodLast4`, `vapiAssistantId`, etc. Spreading the raw row leaked all of it to any authenticated team member (caught in architect review during the worker/subcontractor/owner account-model work).

**How to apply:** the handler keeps a `WORKER_VISIBLE_SETTINGS_KEYS` allowlist and builds the worker response by picking only those keys (plus an explicitly-computed `subscriptionTier` = effective inherited tier, `simpleMode`, resolved `logoUrl`, `tradeType`). Owners still get their own full row (their own data). Prefer **allowlist over denylist** — a denylist silently leaks any newly-added sensitive column. If you add a new display need for workers, extend the allowlist; never switch back to spreading the full row for non-owners.
