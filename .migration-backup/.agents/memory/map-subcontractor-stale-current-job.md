---
name: Web Job Map subcontractor hidden by stale current_job_id
description: Why a location-sharing subcontractor can vanish from the web Job Map even with a real active job
---

The web Job Map (`GET /api/map/team-locations`) gates subcontractor visibility on
having an in-progress job: `if (isSubcontractor && !hasActiveJob) return null;`.
Workers are never gated; subcontractors only appear while on an active job (privacy
by design — keep that gate).

**Bug pattern:** the handler resolves the current job from
`tradie_status.current_job_id`, which can be **stale** (point to a job that is now
`done`). It set `activeJob` to that done job, which short-circuited the in-progress
fallback lookup, so `hasActiveJob` stayed false and a subcontractor who genuinely
HAD a separate `in_progress` job got dropped.

**Why:** the fallback was gated on `!activeJob`, but a stale-but-non-null current
job makes `activeJob` truthy without being in_progress.

**How to apply:** run the in-progress re-query whenever the resolved job isn't in
progress, not just when it's null:
`if ((!activeJob || activeJob.status !== 'in_progress') && isSubcontractor)`.

**Don't confuse the two map endpoints:** web map = `/api/map/team-locations`;
mobile map = `/api/team/locations`. The mobile one does NOT have this bug — it
derives the current job from the active time entry and always falls back to the
in_progress query, so it's immune to the stale `current_job_id`.
