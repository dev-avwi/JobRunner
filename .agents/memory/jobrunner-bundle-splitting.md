---
name: JobRunner web bundle splitting
description: Rules to keep the web app's entry bundle small (schema leak + manualChunks)
---

# JobRunner web bundle splitting

- Never import runtime values from `@shared/schema` in eagerly-loaded frontend code — the full drizzle schema (+drizzle-orm+zod, ~240 kB min) gets bundled. Dependency-free constants like worker permissions live in `@shared/permissions` (lib/db/src/schema/permissions.ts, re-exported by schema.ts for the server). Keep that file free of drizzle/zod imports.
- `vite.config.ts` uses a manualChunks *function* (the object/array form failed to match `react-dom` under pnpm) to split vendor-react/motion/query/sentry/ui. Entry chunk went 1167→351 kB; keep new always-loaded heavy vendors in a group so the 500 kB warning stays silent.
- To smoke-test the production bundle in the preview proxy, temporarily switch the jobrunner `dev` script to `vite preview` and restart the workflow (the proxy only routes to the managed workflow); revert afterwards.

**Why:** chunk-init (TDZ) bugs and schema bloat only show in production builds; dev server hides them.
**How to apply:** whenever adding eager imports to App-level code or new large dependencies in artifacts/jobrunner.
