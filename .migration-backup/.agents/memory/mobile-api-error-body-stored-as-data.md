---
name: Mobile api.get returns error body as res.data
description: Why `if (res.data) setX(res.data)` crashes the render on non-2xx, and how to guard
---

The mobile api client (`mobile/src/lib/api.ts`) returns the parsed ERROR body as `res.data` on a non-2xx JSON response: `{ error, data: errorData as T }`. So `res.data` is TRUTHY even on failure, but its shape is the error object (e.g. `{ error: "Job not found" }`), NOT the expected payload.

**Footgun:** `const res = await api.get<T>(url); if (res.data) setState(res.data);` stores the error object as if it were real data. The next render reads a nested leaf (e.g. `pd.revenue.invoiced`) → "Cannot read property X of undefined" render crash. This pattern is repeated in MANY mobile screens, not just one.

**How to apply:** when consuming `api.get`, gate on `!res.error` AND validate the expected top-level objects are present before storing; ideally normalize once into a fully-formed shape with numeric/array defaults so no render site can hit an undefined leaf. On failure store `null` (or an empty default) and let the component show its empty state.

**Concrete case (job profitability):** `/api/jobs/:id/profitability` (`server/routes/jobs.ts`) is owner-scoped — `storage.getJob(jobId, userId)` returns null for a worker/subcontractor who only has a `job_assignments` row, so it 404s "Job not found". Returning owner financials (revenue/labour/margin) to non-owners would be a data leak, so the 404/403 is CORRECT — the bug was the client storing the error body. Fixed in `mobile/app/job/[id].tsx` `loadProfitability` by requiring `!res.error` + `revenue/costs/profit/hours` present, then normalizing leaves to numbers. (Consider gating the whole profitability card on `!isSubcontractorUser` too, matching the existing Job Costing gate, so subs don't even fetch it.)
