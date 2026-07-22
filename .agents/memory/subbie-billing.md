---
name: Subbie-bill labour pricing
description: Why subcontractor billing-builder job amounts show $0.00 and the rate source to trust.
---
The subcontractor billing builder (mobile `app/more/subbie-bill.tsx`) gets suggested job
amounts from `GET /api/subcontractor/completed-jobs`. That endpoint must price labour from
**each `time_entries` row's own `hourlyRate`** (falling back to assignment override /
membership rate only when an entry has none), NOT from the membership/assignment rate alone.

**Why:** a joined subcontractor often has no membership `hourlyRate` or per-job
`hourlyRateOverride` set, so `totalHours * membershipRate` = $0.00 — even though the worker
already saw real earnings (e.g. $11.33) on the Time Tracking screen, which is driven by the
per-entry rate. Pricing off the per-entry rate keeps the bill consistent with what the worker
was shown as "earned".

**How to apply:** sum `hrs * (te.hourlyRate || fallbackRate)` per entry. Note `time_entries`
in this schema has `hourlyRate` but NOT `totalEarnings` (that column lives on another table) —
don't reference `te.totalEarnings` or tsc fails (esbuild prod build skips typecheck so it'd ship).
---
name: Subcontractor billing must exclude break time entries
description: Subbie invoice/billing endpoints summed break time_entries into billable hours; breaks are unpaid and must be filtered everywhere.
---

The subcontractor billing surfaces built billable `timeEntries`/`suggestedHours` from `time_entries` **without** filtering `isBreak`, so a logged break (e.g. 36m) showed up as a billable labour line in the mobile "Create Tax Invoice" modal.

**Rule:** every subbie billing path must exclude `te.isBreak` when summing hours or offering selectable time entries. Breaks are unpaid.

**Where this matters (all in `server/routes.ts`):**
- `GET /api/subcontractor/unbilled-work` — main invoice modal source (filter `!te.isBreak` when building `jobTimeEntries`).
- `GET /api/subcontractor/completed-jobs` — flexible billing-builder suggestions (same filter).
- `POST /api/subcontractor/invoices` — recalculates from supplied time-entry IDs; reject `entries.some(te => te.isBreak)` as defense-in-depth (client no longer offers breaks, but stale/forged payloads could).
- `POST /api/subcontractor/billing-documents` — trusts client-entered `quantity`/`unitPrice` (does NOT sum time entries), so no break filter needed there; its suggestions come from completed-jobs.

**Why:** the rest of the codebase already filters `!e.isBreak` in time-entry aggregations; these subbie endpoints were the ones that missed it. Mobile `app/job/[id].tsx` correctly shows breaks as non-billable orange rows — billing should match.

**How to apply:** when adding any new subbie/worker billing or earnings aggregate, mirror the `!isBreak` filter. `time_entries.isBreak` is a real boolean column.
---
name: Subcontractor earnings vs invoice rate sources
description: Why the subcontractor dashboard "earnings" figure and an invoice total can disagree for the same time entries.
---

The subcontractor sees a dollar figure in two places that are computed from DIFFERENT rate sources and at DIFFERENT times. They legitimately disagree.

- **Dashboard earnings (lnWeek/lnMonth, /api/subcontractor/dashboard)** recompute LIVE on every load. The rate is the **membership hourly rate** for business jobs (`memberships.find(...).hourlyRate`) or the user's own default rate for solo jobs. It does **not** read `time_entries.hourly_rate` at all.
- **An invoice (POST /api/subcontractor/invoices)** is a **frozen snapshot** taken at submit time. Per time entry the rate resolves as `time_entry.hourlyRate || assignment.hourlyRateOverride || membership.hourlyRate || 0`, and the computed total is written into the row permanently. It never recalculates afterward.

**Consequence:** if `time_entries.hourly_rate` is null/blank at the moment of submit AND both the assignment override and membership rate are empty, the invoice locks in $0 — even though the time-entry list / reports (which DO read `time_entries.hourly_rate`) may later show money once a rate is backfilled onto the entries.

**Why:** these surfaces were built against different rate fields; there is no single canonical "subcontractor rate" on this DB. A backfill or edit to one field does not retro-update a saved invoice.

**How to apply:** when a subcontractor reports "time tracking shows money but my invoice is $0" (or any rate mismatch), check which surface they mean and which field carries a rate. The server now rejects a $0 labour line at submit (hours>0 && labourAmount<=0). Subcontractor invoices can be deleted in-app (DELETE /api/subcontractor/invoices/:id) unless paid or already synced to accounting.
