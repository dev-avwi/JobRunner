---
name: One-way spreadsheet sync
description: Design constraints of the outbound Excel/Google Sheets sync feature
---

# One-way Excel/Google Sheets sync

- Strictly outbound by design: JobRunner is the source of truth; each sync fully replaces spreadsheet contents (batchClear then batchUpdate). Never add inbound reads.
- All sheet-sync/Google-Sheets columns on `business_settings` are omitted from the generic `businessSettingsWriteSchema`; configuration happens ONLY via the owner-only `/api/sheet-sync/*` routes. New sync fields must follow both rules.
- **Why:** the generic settings route is mass-assignment-hardened, and tokens/last-run state must never be client-writable.
- Consistency rule: any state transition that makes the `google_sheets` target unusable (disconnect, or switching target to Google while unconnected) must ALSO force `sheetSyncEnabled=false` server-side, or the scheduler runs into guaranteed failures and spams error notifications. UI disabling alone is insufficient.
- Scheduler polls every 30 min via `processDueSheetSyncs()` (due = elapsed ≥ frequency − 25 min tolerance); scheduled failures notify the owner in-app, manual runs return the error.
- Google OAuth tokens are stored AES-256-GCM encrypted with an `enc:v1:` prefix (seal/open helpers in the sync module); values without the prefix or failing decryption are treated as invalid → connection wiped, owner reconnects. Never persist a raw token. Completion review REJECTS plaintext OAuth tokens at rest — use `server/encryption.ts` for any new integration credentials.
- drizzle-zod json-array columns (e.g. the data-type list) need an explicit `z.array(...)` pin in the insert schema extend (same quirk as `workDays`) or typecheck fails with a huge record-type error.
