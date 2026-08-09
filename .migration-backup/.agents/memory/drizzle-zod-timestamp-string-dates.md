---
name: drizzle-zod timestamp columns reject ISO-string dates
description: createInsertSchema maps timestamp cols to z.date(); JSON clients send strings → "Invalid expense data" style 400s
---

`createInsertSchema(table)` from drizzle-zod maps a `timestamp(...).notNull()` column to
**`z.date()`**, which accepts ONLY a real `Date` object — it rejects ISO strings with
"Expected date, received string".

Both the mobile app and the web app send dates over JSON as ISO strings
(`someDate.toISOString()`). So any route that does `insertXSchema.parse(req.body)` on a
table with a required timestamp will **reject every create** with a generic 400 (here it
surfaced as `{"error":"Invalid expense data"}` on `POST /api/expenses`).

**Fix:** override the timestamp field to coerce in the insert schema:
```ts
export const insertExpenseSchema = createInsertSchema(expenses, {
  expenseDate: z.coerce.date(),   // accepts Date OR ISO string, still validates
}).omit({ id: true, userId: true, createdAt: true, updatedAt: true });
```
`z.coerce.date()` is backward-compatible (Date objects still pass), so it's the safe fix.

**Why:** the generic 400 message hides the real Zod issue; the route only logs detail to
console. When a "create X" silently fails with "Invalid X data", suspect a string-vs-Date
(or string-vs-number) coercion mismatch on a timestamp/decimal column before anything else.

**How to apply:** any NEW insert schema whose table has a user-supplied required timestamp
should coerce that field (and audit existing ones). Test fast with a tsx script doing
`schema.safeParse({...})` rather than round-tripping through the API.
