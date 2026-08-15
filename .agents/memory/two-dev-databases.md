---
name: Two dev databases
description: DATABASE_URL and NEON_DATABASE_URL point at different databases in the dev workspace
---

The dev workspace environment defines BOTH `DATABASE_URL` and `NEON_DATABASE_URL`, and they are different databases. The api-server's boot alias (`NEON_DATABASE_URL` → `DATABASE_URL`) only kicks in when `DATABASE_URL` is unset — so in this workspace the running api-server, its `session` table, and the demo data all live in the `DATABASE_URL` database, while `NEON_DATABASE_URL` holds a separate copy with other data (e.g. project-type jobs with phases).

**Why:** cost me a debugging loop — inserted a smoke-test session row into NEON and got 401s because the server reads sessions from DATABASE_URL.

**How to apply:**
- Any raw `ALTER TABLE` schema fix must be applied to BOTH databases.
- To smoke-test authed endpoints, insert a row into the `session` table of the DATABASE_URL database (`sid`, `sess` JSON `{"userId": ...}`, `expire`) and pass it as `Authorization: Bearer <sid>`; clean up after.
- When querying, `job_id`/`id` column types differ (uuid vs varchar) across tables — cast with `::text` in joins.
