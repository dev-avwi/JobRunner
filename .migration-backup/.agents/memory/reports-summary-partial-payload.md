---
name: Reports summary partial payload
description: /api/reports/summary can return partial nested data despite a non-optional type, crashing the reports screen
---

The mobile reports screen renders dozens of `summary.revenue/jobs/quotes/invoices.<field>` accesses.
The `ReportSummary` type declares all nested sections as required, but at runtime the
`/api/reports/summary` endpoint can return a partial object (a nested section missing),
which throws "Cannot read property '<field>' of undefined" during render/export.

**Rule:** When consuming `summary` from the reports store, normalise it once (a `useMemo`
that returns the raw null/undefined unchanged so the `!summary` loading/empty gates still
work, but fills every nested section with `?? 0` defaults when present). Do NOT rely on the
TS type being accurate for nested presence.

**Why:** A single optional-chain at one call site is not enough — the same screen
dereferences the nested sections in many render blocks AND the CSV/share export functions,
so any partial payload re-crashes elsewhere.

**How to apply:** Normalise at the top of the component (or a store-level selector) before
any `summary.x.y` access. Avoid `{default, ...spread}` literals (TS2783); use explicit
`raw.section?.field ?? 0` per field.
