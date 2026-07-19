---
name: Offline form-submission sync (mobile job cards)
description: Rules for offline edit/delete of job-card submissions — tombstones, write-through cache, server contract
---

- Server contract (verified by curl): sync replays use flat endpoints — POST /api/form-submissions (create), PATCH /:id with `submissionData` key (server also normalizes `data`), DELETE /:id. "Not found" wording is "Submission not found"; delete handler treats 404 as success (idempotent replay).
- **Tombstone rule**: an offline delete of a server-backed row must NOT hard-delete the local cache row. Keep it with `pending_sync=1, sync_action='delete'` or the write-through cache (`cacheServerFormSubmissions`) resurrects the card on the next online load before the queued delete syncs. Clear the tombstone only in the delete sync handler after server confirms.
- **Why:** architect review caught a real resurrection bug from hard-deleting first.
- **How to apply:** any new offline-deletable entity that also has a write-through cache needs the same tombstone + cache-skip pattern; the cache refresh must skip both pending rows AND queued deletes.
- Tombstone rows can have NULL job_id, so tombstone lookups must query ALL local rows, not the per-job filter.
- `form_submissions_local` is shared with SWMS (form_id `swms:` prefix) — filter it when listing job cards. Table is already in clearCache().
- Local `local_` rows: edits rewrite the queued create payload; deletes just drop row + queued create (nothing reached the server).
