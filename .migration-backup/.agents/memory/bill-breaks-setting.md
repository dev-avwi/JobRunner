---
name: Bill-for-breaks setting (billBreaks)
description: How the owner toggle for billing break time to clients is wired across server/web/mobile, and the worker-visibility gotcha.
---

# billBreaks business setting

`business_settings.billBreaks` (boolean, default false) lets an owner opt in to
charging tracked break time as billable labour on client invoices. Billing-only —
it does NOT change worker pay/earnings.

## Where it's applied (client-invoice labour surfaces only)
- `server/labourService.ts` — the `billableEntries` filter (source of truth for
  `generateLabourSummary` / `generateLabourLineItems`): break entries are billable
  only when `business.billBreaks`; non-break entries keep `isBillable !== false`.
- `client/src/components/LiveInvoiceEditor.tsx` `buildJobChargeItems` — filters
  `e.endTime && (billBreaks || !e.isBreak)`.
- `mobile/app/more/invoice/new.tsx` — same filter (this builder previously had NO
  break filter, i.e. it silently over-billed breaks; the toggle fixed that, so the
  default-OFF now correctly excludes breaks).

Deliberately NOT touched: worker pay/earnings, and the dashboard "billable hours"
stats (those are time-tracking displays, not invoicing).

## The non-obvious gotcha (cost a review cycle)
**Any new business setting that must apply business-wide to WORKER sessions must be
added to `WORKER_VISIBLE_SETTINGS_KEYS` in `server/routes.ts`**, not just to the
write allowlist. `GET /api/business-settings` returns a filtered payload to
non-owners; if the key isn't in that allowlist, every worker session resolves it to
`undefined`/default. Both invoice builders read `businessSettings?.billBreaks`, so a
worker building an invoice would ignore the owner's choice.

**Why:** owner-only write protection (`ownerOnly()` + omit-list write schema) is
separate from worker READ visibility — they are two different allowlists.

**How to apply:** when adding a settings field that workers' UI/logic reads, edit
both: (1) keep it OUT of the write-schema omit list (so owners can set it), and
(2) ADD it to `WORKER_VISIBLE_SETTINGS_KEYS` (so workers can read it).
