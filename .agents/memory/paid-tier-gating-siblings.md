---
name: Paid-tier gating must cover ALL sibling action endpoints
description: Locking a feature to paid plans means gating every write/action route, not just connect/sync — accounting has ~35 action endpoints per the integrations group.
---

When locking a feature behind `requirePaidTier()`, gating the obvious entry points (e.g. `connect`/`sync`) is NOT enough. A free/lapsed user can still call sibling action endpoints directly.

**Why:** The accounting integrations group (Xero/MYOB/QuickBooks) exposes ~35 write/action endpoints beyond connect/sync — push-invoice, push-quote, push-client, void-invoice, sync-credit-notes, sync-inventory, full-sync, pull-invoices/quotes, push-selected-*, switch-tenant, mobile-connect, myob credentials, qbo auth-url, etc. Gating only connect/sync left every one of those open (auth-only), an access-control bypass an architect review caught.

**How to apply:** Enumerate the whole route group (`rg 'app\.(get|post|put|patch|delete)\("/api/<group>'`), then gate every WRITE/action route with `requirePaidTier()` placed as `requireAuth, requirePaidTier(), [ownerOnly()...]` (auth first, tier second, role last). Intentionally LEAVE UNGATED: OAuth callbacks, signed webhooks, GET status/health reads, config reads, and `disconnect`/`test` (so a lapsed user can still clean up / diagnose). Also gate manual triggers like `/api/automations/process-time-based`. Verify a paid tier is NOT 402 on the gated routes (500/400 from "not connected"/"not configured" upstream are fine — they prove the request passed the tier gate).
