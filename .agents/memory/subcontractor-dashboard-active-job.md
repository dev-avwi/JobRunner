---
name: Subcontractor dashboard active job source
description: The subcontractor dashboard "Active Job" card must be driven by the running time entry, not an assigned-jobs in_progress filter.
---

`GET /api/subcontractor/dashboard` returns `activeJob`, which the mobile `SubcontractorDashboard` renders as the "In Progress / running timer" card.

**Rule:** derive `activeJob` from the running time entry (`timeEntries` where `userId = self` AND `endTime IS NULL`, latest first), then resolve+enrich the linked job. Pin `startedAt` to the time entry's `startTime` so the card's elapsed time matches the live timer. Fall back to the old `enrichedJobs.find(status==='in_progress')` only when no timer runs.

**Why:** the original code derived `activeJob` ONLY from `enrichedJobs` (jobs assigned from OTHER businesses via `jobAssignments`) filtered by `status==='in_progress'`. That misses two real cases: (1) the subcontractor's OWN solo jobs (owned by them, never in the assigned list), and (2) timer-running state in general. Result: a subcontractor clocked in for 30+ min saw an empty dashboard while the owner dashboard correctly showed them on the clock.

**How to apply:** the running entry is the user's OWN entry, so surfacing its job is NOT a cross-tenant leak (unlike the business-wide who's-clocked-in query — see time-entries-no-tenant-column.md). When the running job isn't in the assigned-enrichment map, fetch it directly and enrich business name/color (own business vs connected business) + client name inline. Keep `activeJob` shape identical to the assigned `enrichedJobs` element type or tsc breaks.
