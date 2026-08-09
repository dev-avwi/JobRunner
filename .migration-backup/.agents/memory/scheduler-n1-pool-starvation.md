---
name: Scheduled jobs N+1 starves Neon pool
description: "Connection terminated due to connection timeout" from a background scheduler is usually an N+1 query pattern, not a DB outage.
---

Symptom: a background/scheduler job (e.g. lifecycle emails, runs every 6h) emails an ERROR alert "Error: Connection terminated due to connection timeout". This is a pg pool **connection-acquire** timeout, not a network/DB outage.

Root cause pattern: the job fetches a list of users/records, then loops and runs several per-row queries sequentially (4 count() queries per user). With a real user base that's hundreds of sequential round-trips. The pool is capped (`server/storage.ts`: max 15, `connectionTimeoutMillis: 10000`, Neon serverless limit) so when the job runs concurrently with normal traffic the pool starves and connection acquisition times out.

**Fix:** collapse per-row queries into a constant number of grouped aggregates — `db.select({ userId, value: count() }).from(table).where(inArray(table.userId, ids)).groupBy(table.userId)` — then map results back. Run the few aggregates in `Promise.all`. Guard `inArray(..., [])` with an early return when the candidate list is empty (empty inArray errors / is a footgun). Rows with zero matches simply won't appear in the grouped result, so default to 0 via `.get(id) || 0`.

**Why:** O(users) sequential queries × pool cap 15 = guaranteed acquire-timeout under load. O(1) grouped queries removes the pressure entirely.
**How to apply:** when you see a scheduler connection-timeout alert, grep the scheduler for `for (...) { await db.select... }` loops before suspecting the DB. Same pattern lurks in any "enrich each row with counts/related data" loop.
