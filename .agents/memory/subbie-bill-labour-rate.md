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
