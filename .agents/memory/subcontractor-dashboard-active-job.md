---
name: Subcontractor dashboard active job source
description: The subcontractor dashboard "Active Job" card must be driven by the running time entry, not an assigned-jobs in_progress filter.
---

`GET /api/subcontractor/dashboard` returns `activeJob`, which the mobile `SubcontractorDashboard` renders as the "In Progress / running timer" card.

**Rule:** derive `activeJob` SOLELY from the running time entry (`timeEntries` where `userId = self` AND `endTime IS NULL`, latest first), then resolve+enrich the linked job. Pin `startedAt` to the time entry's `startTime` so the card's elapsed time matches the live timer. If no entry is running, `activeJob = null` — do NOT fall back to `enrichedJobs.find(status==='in_progress')`.

**Why (two bugs, opposite directions):**
1. Original code derived `activeJob` ONLY from `enrichedJobs` (jobs assigned from OTHER businesses via `jobAssignments`) filtered by `status==='in_progress'`. That missed (a) the subcontractor's OWN solo jobs (never in the assigned list), and (b) timer-running state. Result: a subcontractor clocked in 30+ min saw an EMPTY dashboard. Fixed by reading the running time entry.
2. A later `in_progress` FALLBACK (set `activeJob` to any in_progress job when no timer ran) caused the OPPOSITE: a job stays `in_progress` after the worker clocks out, so the mobile card — which ticks a live timer purely from `activeJob.startedAt` (hours-old `job.startedAt`) — showed a PHANTOM running timer (~3h) while the job's own Time Tracking was stopped. Removed the fallback: no running entry → `activeJob: null` → card hidden (the job still shows in Today's Schedule). Server-only fix, no mobile rebuild.

**Break case:** a break is a running entry (no `endTime`), so `activeJob` is still returned and the mobile "On Break" visual still renders. Mobile already types `activeJob` nullable and conditionally renders the card, so `null` is safe.

**How to apply:** the running entry is the user's OWN entry, so surfacing its job is NOT a cross-tenant leak (unlike the business-wide who's-clocked-in query — see time-entries-no-tenant-column.md). When the running job isn't in the assigned-enrichment map, fetch it directly and enrich business name/color (own business vs connected business) + client name inline. Keep `activeJob` shape identical to the assigned `enrichedJobs` element type or tsc breaks.
