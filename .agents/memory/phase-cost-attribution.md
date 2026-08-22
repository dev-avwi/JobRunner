---
name: Phase cost attribution
description: How job costs are attributed to phases in the profitability endpoint, and why
---

Labour (time entries), materials, and POs prefer an explicit `phaseId`, then fall back to the scheduled phase window (`scheduledStart`..`scheduledEnd`, end inclusive to end-of-day; first matching phase by sortOrder). Expenses use their explicit `phaseId` only: an absent or unrecognised link goes to an "Unallocated" bucket appended to the `phases` array with `id: null`.

Phase actual cost is labour + subcontractor labour + materials + expenses. Purchase orders remain informational and are excluded from totals to avoid double-counting.

**Why:** date windows preserve useful attribution for historical labour/material data, but expenses are deliberately assigned by the user to a specific phase, so inferring a phase from the expense date can produce misleading budget warnings.

**How to apply:** use `costs.total` for phase budget warnings. When extending phase cost displays, include the `expenses` component and do not add purchase orders to actuals.
