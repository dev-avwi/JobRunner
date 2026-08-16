---
name: Phase cost attribution
description: How job costs are attributed to phases in the profitability endpoint, and why
---

Only `job_variations` carries a `phaseId` link. Labour (time entries), materials, and POs have no phase column, so the profitability endpoint attributes them to a phase when their date falls inside the phase's scheduled window (`scheduledStart`..`scheduledEnd`, end inclusive to end-of-day; first matching phase by sortOrder). Non-matching items go into an "Unallocated" bucket appended to the `phases` array with `id: null`.

**Why:** avoids schema changes and works with existing data; adding phase_id columns would leave all historical costs unattributed.

**How to apply:** the profitability endpoint now prefers explicit `phaseId` and falls back to date-window — this is live. Phase `costs.total` deliberately excludes POs to avoid double-counting with materials/expenses.

Explicit `phaseId` columns now exist on `time_entries`, `job_materials`, and `purchase_orders`. DATABASE_URL has FK constraint to job_phases(id); NEON_DATABASE_URL has plain varchar (UUID type mismatch — job_phases.id is UUID in NEON, varchar in DATABASE_URL).

UI: web TimerWidget shows phase picker (Select) when job has phases; web add-material form shows phase picker after Notes field; mobile add-material modal shows phase chip-picker; mobile timer start shows an action sheet phase picker for project jobs with phases.

Note: `job_variations.phase_id` and the new columns had to be added to BOTH dev databases via raw ALTER (see two-databases note).
