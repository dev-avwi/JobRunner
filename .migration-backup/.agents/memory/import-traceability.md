---
name: Import traceability (import_runs)
description: Every data import must create/finalize an import_runs row and tag created records, or history/undo silently misses it
---

Both import paths (legacy /api/import/preview+execute and smart import) open a **pending** `import_runs` row at upload/preview time (original file retained in object storage under `imports/`), tag every created row with `import_run_id` + `import_row_number` (spreadsheet row = data index + 2), and finalize the run (status `completed`, counts) after the write. History/undo routes live in `server/routes/import-history.ts`.

**Why:** Import History + one-tap undo (trust anchor for migrating businesses) only sees finalized runs; untagged rows can never be undone.

**How to apply:** Any NEW import path (new type, new route, re-import mode) must: (1) `createPendingImportRun` + `persistImportFile`, (2) tag inserts — including side-created clients in findOrCreateClient helpers, (3) `finalizeImportRun` on success. Undo treats `updated_at > created_at + 10s` as "edited since import" and 409s for a 3-way decision (`keepEdited` / `confirmEdited`). Pending run ids from clients must go through `resolvePendingImportRun` (owner + pending check) to avoid IDOR. Prod ALTERs are in `scripts/post-merge.sh` (Task 300 block).
