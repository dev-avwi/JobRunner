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

**Env footguns:** `cd` in the bash tool is blocked — use `npm --prefix mobile ...` or
`bash mobile/scripts/typecheck.sh` (it cds internally). `npm exec -- tsc` got killed.
