---
name: Offline cache logout wipe
description: Any new mobile SQLite cache table/key must be wiped in clearCache() or it leaks across accounts
---

**Rule:** whenever a new offline cache is added on mobile (new SQLite table, or new keys in the generic `subscription_cache` JSON key-value store), it MUST be included in `offlineStorage.clearCache()` — that's the only logout wipe path.

**Why:** clearCache() originally deleted only jobs/clients/quotes/invoices/time_entries/attachments/sync_queue/metadata. New caches (subscription_cache, chat_messages, form_submissions_local, geofence_events_local) silently survived logout → prior account's team members / job data / chat visible offline to the next account on the same device. Architect flagged this as release-blocking.

**How to apply:**
- Side tables are deleted in a per-table try/catch loop inside clearCache() so a missing table on an older on-device schema can't abort the wipe. Add new tables to that loop.
- `subscription_cache` is a handy generic JSON cache (cacheSubscriptionData/getCachedSubscriptionData with TTL) for offline snapshots of sub-resources (job materials, team members, assignments) — no schema migration needed. Keys are NOT user-scoped, so the logout wipe is what prevents leakage. Workspace-switch without logout can still show stale cross-workspace data (accepted; namespace keys by businessId if it ever matters).
- Jobs created offline carry a `local_` id; job detail must load those from cache first, then fall through to a normal fetch (id may already be remapped to a server id by sync).
