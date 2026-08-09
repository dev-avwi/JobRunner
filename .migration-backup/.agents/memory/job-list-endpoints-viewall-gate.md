---
name: Job-list endpoints must reuse the /api/jobs VIEW_ALL gate
description: Any endpoint returning a list of jobs (map, dispatch, exports) must apply the same non-VIEW_ALL worker filter as GET /api/jobs, or it leaks every business job to a plain worker.
---

`GET /api/jobs` (the Work view) restricts team members to assigned jobs with:

```
const hasViewAll = userContext.permissions.includes('view_all') || userContext.isOwner;
if (!hasViewAll && userContext.teamMemberId) {
  jobs = jobs.filter(j => j.assignedTo === userContext.userId || j.assignedTo === userContext.teamMemberId);
}
```

**Why:** `GET /api/map/jobs` originally filtered only on `userContext.isSubcontractor`,
so a *staff tradie* (isStaff, not a subcontractor) and any non-VIEW_ALL worker saw
EVERY business job on the map — 27 pins when their Work list showed 3. The
subcontractor-only check is the wrong gate; the canonical gate is VIEW_ALL.

**How to apply:** Any new endpoint that returns or aggregates jobs (map, dispatch
board, calendar, exports, reports) must copy the `hasViewAll` block above — not a
role-name check like `isSubcontractor`. Grep `storage.getJobs(` across the server
and confirm each call site that returns jobs to a client applies the gate.

Mobile mirrors this as defense-in-depth (`canViewAllJobs = isOwner||isManager||isSolo`
in `mobile/app/(tabs)/map.tsx`), but the **server is canonical** — there is no
`view_all` permission key on mobile, so the client filter is role-based and only a
backstop. Never rely on the client filter alone.
