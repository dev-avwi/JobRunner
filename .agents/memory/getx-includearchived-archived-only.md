---
name: getQuotes/getInvoices/getJobs includeArchived is archived-ONLY
description: storage.getX(userId, includeArchived) returns ONLY archived rows when true and ONLY active rows when false — never both.
---

`storage.getQuotes/getInvoices/getJobs(userId, includeArchived?)` is NOT "include
archived in addition to active". The flag SWITCHES the set:
- `false`/omitted → `isNull(archivedAt)` → ONLY active rows
- `true` → `isNotNull(archivedAt)` → ONLY archived rows

**Why this bites:** to operate on the FULL set (e.g. a total wipe of an account,
or counting "all" quotes) you must call BOTH and concat: `[...getX(id,false),
...getX(id,true)]`. Passing `true` alone silently returns 0 when nothing is
archived — which once looked like "data corruption / partial seed" during demo
verification when the data was actually fine.

**How to apply:** any reset/wipe/full-export over quotes/invoices/jobs must merge
both calls. Any "does this account have data?" check should use the active set
(`false`), not `true`.
