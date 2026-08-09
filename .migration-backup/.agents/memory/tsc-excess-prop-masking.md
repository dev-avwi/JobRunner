---
name: tsc excess-property masking
description: Why removing one bad field from an object literal can surface NEW tsc errors on the same literal, and why server type errors are real shipped bugs here.
---

# tsc excess-property errors mask each other; prod build does NOT typecheck

**Rule:** `tsc` TS2353 ("Object literal may only specify known properties") reports only the
FIRST excess property per object literal. When you delete that property, the NEXT excess
property on the same literal surfaces on the following `tsc` run. So fixing object-literal
errors is iterative — re-run `tsc` after each batch; the count can go *up* locally before
it goes to 0.

**Why it matters here:** the prod build is `esbuild`, which strips types WITHOUT checking.
So `npm run check` (tsc --noEmit) is the ONLY gate catching these, and every server-side
type error is a genuine shipped bug, not noise.

**How to apply:**
- Drive `npm run check` to 0 by re-running after edits, not by trusting one error list.
- A registered validation gate named `check` runs `npm run check` — keep it green.
- Real runtime bugs found this way (pattern, not a one-off): function called with wrong
  arg shape (positional args vs single options object), `db.delete(table).where(eq(table.X,…))`
  referencing a column that doesn't exist on that table (drizzle would throw at runtime),
  and `.where(eq(table.someOwnerCol,…))` on a GLOBAL table that has no owner-scoping column.
  Confirm the canonical column/method name in `shared/schema.ts` / `server/storage.ts`
  before "fixing" — the schema is the source of truth, fix the caller.
