---
name: Mobile typecheck false-clean from deps drift
description: Local mobile typecheck can pass while CI fails if node_modules drifts from the lockfile
---

# Local mobile typecheck lies if node_modules drifts from the lockfile

`bash mobile/scripts/typecheck.sh` runs `tsc` against whatever is in
`mobile/node_modules`. If the workspace's installed deps drift from
`mobile/package-lock.json`, the local run can show 0 errors while CI fails — CI does a
clean `npm ci`, installing the LOCKED versions.

**Real incident:** CI "Mobile Typecheck" failed but local was clean. The workspace had
stale `@types/react` 18 + TS 5.6; the lockfile pins `@types/react` 19.1.17 + TS 5.9.3.
React 19's `@types/react` removed the zero-arg `useRef` overload, so
`useRef<ReturnType<typeof setTimeout>>()` only errors under the locked deps. Fix was
`useRef<...| undefined>(undefined)`, but it was INVISIBLE locally until deps were synced.

**Rule:** before trusting `mobile/scripts/typecheck.sh` (or claiming a CI typecheck
failure is fixed), run `npm --prefix mobile ci` first to match CI exactly.

**DANGER (env-specific, observed 2026-06-14): do NOT run `npm --prefix mobile ci` in
the Replit workspace.** `npm ci` ALWAYS wipes `mobile/node_modules` first, then restores
from registry/cache. The package firewall (`package-firewall.replit.local`) BLOCKS
`shell-quote@1.8.3` (security policy → HTTP 403) and that tarball is NOT in the offline
cache (`ENOTCACHED`), so the restore fails ATOMICALLY and leaves `mobile/node_modules`
EMPTY and UNRECOVERABLE in-env (offline also lacks `@babel/core` etc). Online retries are
forbidden per the package-management skill (403 = security block, don't retry). Net: one
`npm ci` permanently breaks the workspace's mobile typecheck for the session. The
workspace's `mobile/node_modules` appears to be platform-provisioned, NOT reproducible via
`npm ci` here. The user's own Mac clone has its own intact node_modules and is unaffected;
no Replit workflow (`Start application`, `check`) depends on `mobile/node_modules`, so the
running app is fine. **If you need to verify mobile changes, rely on static reasoning +
the architect review; do not `npm ci`. Server/web typecheck is `npm run check` (root tsc),
which is independent of mobile.**

**Env footguns:** `cd` in the bash tool is blocked — use `npm --prefix mobile ...` or
`bash mobile/scripts/typecheck.sh` (it cds internally). `npm exec -- tsc` got killed.
Background `npm ci` started with `nohup ... &` gets KILLED when the bash call returns —
run it FOREGROUND with `timeout 110 npm --prefix mobile ci` (it finishes in ~1m).

## The opposite trap: local FALSE-CLEAN from the ROOT node_modules leaking in
The bigger gotcha is the reverse of deps-drift: a local mobile typecheck can show 0
while CI shows many errors, even with a correct `npm --prefix mobile ci`. Reason: tsc
resolves `@types`/modules by walking UP the dir tree, so from `mobile/` it also sees the
repo-ROOT `node_modules` (the server/web app's deps). CI's mobile job only `npm ci`s in
`mobile/` — the root install does NOT exist there. So root deps (e.g. `drizzle-orm`,
`@types/*`) silently satisfy types locally that are absent in CI.

**To reproduce CI faithfully:** temporarily hide the root install for the tsc run only —
`mv node_modules node_modules.cihide; (cd mobile && tsc --noEmit); mv node_modules.cihide node_modules`
(do it all in ONE bash call with a `trap` restore so the running app workflows aren't
left broken). This is what surfaced the real CI error set.

**`mobile/tsconfig.json` must NOT blanket-include `../shared/**/*.ts`.** Mobile imports
nothing from `shared/`, but that include forced `shared/schema.ts` into the mobile
compile; schema.ts needs `drizzle-orm` (a ROOT-only dep), so it threw ~167 errors in the
mobile-only CI env while being invisible locally. Removed the include — tsc still checks
any shared file mobile actually imports via the import graph. Keep shared/* typing
protected by the root/server typecheck, not the mobile one.

**Empty baseline = "expect 0 errors".** `mobile/scripts/typecheck-baseline.txt` is empty
by design (Task #170 drove it to 0). It was regenerated locally where root deps masked
the failures, so it under-counted. Don't `--update` the baseline from a root-installed
shell — only regenerate it in the root-hidden (CI-faithful) env, or you re-bake the lie.
