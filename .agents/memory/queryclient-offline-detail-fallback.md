---
name: Web queryClient offline fallback vs sub-resource keys
description: Default queryFn offline fallback returned a cached parent object for sub-resource list keys
---
The web default queryFn (client/src/lib/queryClient.ts) has an offline/failed-fetch fallback that reads IndexedDB stores keyed off the FIRST query-key segment (`/api/jobs` → jobs store).

**Why:** keys like `['/api/jobs', jobId, 'variations']` were classified as "detail" queries, so on a dropped connection the fallback returned the single cached JOB OBJECT to a query expecting an array → prod crash "Dr.filter is not a function" on the job page (2026-07-25).

**How to apply:** detail = exactly `[endpoint, id]`; any key with a third segment is a sub-resource list and must fall back to `[]`. When adding new query keys with `[endpoint, id, 'sub']` shape and a default queryFn, remember the offline fallback returns `[]` for them — object-shaped sub-resources need their own queryFn with an explicit fallback.
