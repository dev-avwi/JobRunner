---
name: drizzle-zod decimal columns reject numbers
description: createInsertSchema types decimal/numeric columns as z.string(); clients sending parseFloat numbers get a silent generic 400.
---

drizzle-zod's `createInsertSchema` maps `decimal`/`numeric` columns to `z.string()`, NOT a number. A client that sends a parsed number (e.g. `parseFloat(input)`) fails `.parse()` and the route returns a generic 400 — the record is never created and any downstream side effect (email/SMS invite) never fires.

**Why:** the team-invite (`/api/team/members/invite`) was rejecting every invite that included an `hourlyRate` because web (`Team.tsx`, `TeamOperations.tsx`) and mobile both sent `hourlyRate: parseFloat(...)` (a number) while the schema wanted a string. Symptom looked like "email never arrived"; real cause was a 400 before send.

**How to apply:**
- Send decimal-column fields as strings from clients, or coerce server-side (`typeof x === 'number' → String(x)`) BEFORE `schema.parse`.
- Guard non-finite numbers (`Number.isFinite`) so `NaN`/`Infinity` don't become the string `"NaN"` and 500 at DB insert — drop to `undefined` instead.
- When a create route returns a generic "Invalid X data" 400, log the zod `issue.path` field names to find the offending field fast.
- Sibling gotcha: timestamp columns map to `z.date()` and reject ISO strings — see drizzle-zod-timestamp-string-dates.md (use `z.coerce.date()`).
