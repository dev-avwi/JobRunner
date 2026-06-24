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
