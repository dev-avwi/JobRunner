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
