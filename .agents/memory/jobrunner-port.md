---
name: JobRunner port decisions
description: Key compatibility decisions when porting the legacy JobRunner app into the pnpm monorepo workspace.
---

# JobRunner port decisions

## Express v4 required (not v5)

The legacy routes file uses Express v4 syntax including optional route params (`:limit?`). Express v5 uses path-to-regexp v8 which rejects this syntax with a PathError at startup. Pin the api-server to `express@^4.21.2`.

**Why:** 50k-line route file can't be safely refactored for a port task.

**How to apply:** Any upgrade of `express` in `artifacts/api-server/package.json` will immediately break route registration.

## @types/express-serve-static-core must be overridden to v4

When `express@4` is in the api-server but the workspace root has `express@5`, two versions of `@types/express-serve-static-core` coexist (v4 and v5), causing `No overload matches this call` TypeScript errors across all middleware usage. Fix: add override in `pnpm-workspace.yaml`:
```yaml
overrides:
  '@types/express-serve-static-core': '4.19.9'
```

## cookie package must be v1.x in api-server

The legacy `websocket.ts` uses `cookie.parse(...)` via namespace import. Cookie v2 removed this export. Pin to `^1.1.1` in the api-server.

## @opentelemetry/* must NOT be external in build.mjs

The api-server's `build.mjs` originally externalizes `@opentelemetry/*`, but @sentry/node v10 needs @opentelemetry at runtime. Bundling it (by removing from the external list) is required.

## zod/v4 → zod

Several copied route files used `import { z } from "zod/v4"` — not a valid package path. Replace with `import { z } from "zod"`.

## drizzle-zod must stay at 0.7.x (Zod v3 compat)

The workspace uses `zod@3.25.76` (v3). drizzle-zod@0.8+ requires Zod v4 types (`_zod` property). Pin `drizzle-zod@^0.7.0` in `lib/db/package.json`.

## bcrypt and puppeteer need approve-builds

Both are blocked by pnpm's default safety policy. Add to `onlyBuiltDependencies` in `pnpm-workspace.yaml`. Without this, bcrypt native bindings don't compile and login silently fails.

## api-server tsconfig: relax two strict rules for legacy code

The base tsconfig has `noImplicitReturns: true` and `useUnknownInCatchVariables: true`. The 50k-line legacy code was written before these rules existed. Override them in `artifacts/api-server/tsconfig.json` to `false` — this is explicit, justified policy for a port, not negligence.

## Large files: @ts-nocheck for legacy service files

Files copied from the original server (`legacyRoutes.ts`, `geocoding.ts`, `gmailClient.ts`, `outlookClient.ts`, `quickbooksService.ts`, `stripeClient.ts`, `pdfService.ts`) have pre-existing type errors. They carry `// @ts-nocheck` at the top. This is intentional policy for the migration.

## Large app: skip OpenAPI spec/codegen

With 80+ endpoints in a 50k-line routes file, rewriting to generated hooks is too risky. Keep the existing `apiRequest`/`queryClient` fetch layer in the frontend as-is.

## @shared/ import strategy

- Frontend: Vite aliases map `@shared/schema` → `lib/db/src/schema/schema.ts`, and `@shared/dateUtils` etc → copies in `artifacts/jobrunner/src/lib/`
- Backend: All `@shared/schema` → `@workspace/db`; `@shared/dateUtils/displayName/tradeCatalog` → `./shared-*` local copies in `artifacts/api-server/src/`
- tsconfig must have matching `paths` entries for frontend so tsc can resolve them

## DB migration

`drizzle-kit generate` produced `lib/db/drizzle/0000_bright_mauler.sql`. Apply with `cd lib/db && pnpm exec drizzle-kit migrate` (needs NEON_DATABASE_URL in env). `drizzle-kit push` hits an interactive TTY prompt.

## Mobile app lives outside artifacts and needs top-level shared/
The Expo app stays at `mobile/` (not an artifact; never npm install there — firewall). Metro watches `../shared`, so a top-level `shared/` copy (dateUtils, schema, etc.) must exist or Metro crashes with ENOENT. The workspace-wide migration moved mobile+shared into `.migration-backup/`; they were copied back.

## Post-merge script must not auto-apply DB schema
`drizzle-kit push` prompts interactively (and offered to TRUNCATE a live table); `migrate` fails on pre-existing tables. The post-merge script only runs `pnpm install`; schema changes are applied deliberately.
