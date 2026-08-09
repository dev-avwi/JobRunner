---
name: JobRunner web bundle splitting
description: Rules to keep the web app's entry bundle small (schema leak + manualChunks)
---

# JobRunner web bundle splitting

- Never import runtime values from `@shared/schema` in any frontend code (eager or lazy) — the full drizzle schema (+drizzle-orm+zod, ~240 kB min) gets bundled into that chunk. Dependency-free constants live in split modules under lib/db/src/schema (`@shared/permissions`, `@shared/pricing`, `@shared/safety-forms`), re-exported by schema.ts for the server. Keep those files free of drizzle/zod imports; type-only imports from @shared/schema are fine. A comment guard sits above the alias in jobrunner's vite.config.ts.
- `vite.config.ts` uses a manualChunks *function* (the object/array form failed to match `react-dom` under pnpm) to split vendor-react/motion/query/sentry/ui. Entry chunk went 1167→351 kB; keep new always-loaded heavy vendors in a group so the 500 kB warning stays silent.
- To smoke-test the production bundle in the preview proxy, temporarily switch the jobrunner `dev` script to `vite preview` and restart the workflow (the proxy only routes to the managed workflow); revert afterwards.

- Big lazy pages (e.g. job detail) split their rarely-used sections/modals via a sibling `*Lazy.tsx` file of `React.lazy` wrappers that carry their own `Suspense` boundary, so call sites stay unchanged. Verified safe in production preview + demo-mode e2e.
- recharts: rollup never duplicates modules across chunks — its core lands in one shared chunk reused by all chart pages; don't force a single vendor-charts chunk (light chart pages would download more).

**Why:** chunk-init (TDZ) bugs and schema bloat only show in production builds; dev server hides them.
**How to apply:** whenever adding eager imports to App-level code or new large dependencies in artifacts/jobrunner.
