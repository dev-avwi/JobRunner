---
name: jobs.notes PATCH writes are dead
description: PATCH /api/jobs/:id deliberately strips notes; real notes live in job_notes table
---

The rule: `PATCH /api/jobs/:id` explicitly deletes `notes` from the parsed body before saving (added by the Collaborative Job Editing work). Any client writing job notes via that PATCH silently no-ops — the request returns 200 but nothing persists.

**Why:** Notes moved to the structured `job_notes` table (per-note rows with author) for collaborative editing. The legacy `jobs.notes` column still exists and is returned on GET (stale/legacy data), which makes the silent drop look like it works.

**How to apply:**
- Write notes via `POST /api/jobs/:jobId/notes` `{content}` (web already does). Mobile's notes editor + offline sync still PATCH `jobs.notes` — a known pre-existing bug (flagged to user 2026-07-08).
- Anything that *reads* job notes (AI summarise, proof packs, exports) must combine BOTH sources: legacy `jobs.notes` + `job_notes` rows.
- GET /api/jobs/:id does NOT merge job_notes into `notes`.
