---
name: Form submission edit/versioning
description: How job-card (form_submissions) edit + version history works and its pitfalls
---
- PATCH /api/form-submissions/:id accepts mobile `data` and normalizes to `submissionData`; snapshots the PRIOR data into form_submission_versions BEFORE update, and fails the whole edit (500) if the snapshot insert fails — history must never silently degrade.
- Access on PATCH/DELETE/versions: resolve via getUserContext → getFormSubmission(id, effectiveUserId), then allow owner context (`*`/manage_team) OR original submitter; raw userId 404s for team members.
- form_submission_versions is created via the idempotent startup-DDL block in server/storage.ts (the standard no-db:push path — prod gets it on Publish). Unique index on (submission_id, version_number); version number assigned atomically in SQL (max+1 subselect) with retry on 23505.
- **Pitfall:** node-postgres reuses `$1` across positions and Postgres errors `inconsistent types deduced for parameter $1` (42P08) when the same param hits varchar and text contexts — cast explicitly (`$1::varchar`).
