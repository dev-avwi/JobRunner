---
name: Phase cost attribution
description: How job costs are attributed to phases in the profitability endpoint, and why
---

Only `job_variations` carries a `phaseId` link. Labour (time entries), materials, and POs have no phase column, so the profitability endpoint attributes them to a phase when their date falls inside the phase's scheduled window (`scheduledStart`..`scheduledEnd`, end inclusive to end-of-day; first matching phase by sortOrder). Non-matching items go into an "Unallocated" bucket appended to the `phases` array with `id: null`.

**Why:** avoids schema changes and works with existing data; adding phase_id columns would leave all historical costs unattributed.

**How to apply:** if a future task adds real phase links to time entries/materials/POs, prefer the explicit link and keep the date-window logic only as fallback. Phase `costs.total` deliberately excludes POs, matching the job-level total (POs are informational to avoid double-counting with materials/expenses).

Note: `job_variations.phase_id` had to be added to BOTH dev databases via raw ALTER (see two-databases note below).
