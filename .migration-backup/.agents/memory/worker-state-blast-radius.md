---
name: Worker presence state blast radius
description: All the places that must stay in sync when adding/removing a worker "state" (the MY STATUS / team presence value)
---

Adding or removing a worker presence state (the value POSTed to `/api/worker/state`) requires touching ALL of these or the state silently misbehaves:

1. **server/routes.ts** — the `validStates` array on `POST /api/worker/state`. Missing here = 400 rejection.
2. **shared/schema.ts** — `WORKER_STATES` const tuple + `WORKER_STATE_CONFIG` map (canonical label/color). Drift here = type/contract mismatch.
3. **mobile/app/(tabs)/index.tsx** — worker dashboard "MY STATUS" widget: the `statusOptions` pill array (what the worker can SET) AND the three current-state-display color ternaries (container bg, dot, text). The display label uses a `charAt(0).toUpperCase()` fallback so single-word states auto-capitalize, but COLOR has no fallback (defaults green) so each new state needs an explicit color branch.
4. **mobile/app/more/team-operations.tsx** — owner live team view: `STATUS_CONFIG` map (drives the status dot color) AND `renderMemberCard`'s separate `pillLabel`/`pillColor` if/else chain + the `subtitle` line. The pill chain is independent of STATUS_CONFIG — it defaults everything to "Available" unless explicitly handled, so a new state shows as "Available" in owner cards unless you add a branch here too.

**Why:** auto-set states (`on_job`, `travelling`, `break`) come from the timer/system, not the pills, so they must remain in `validStates`/display even if the worker can't pick them. The pills are pure presence (`available`/`busy`/`unavailable`); the timer card owns break. An architect review caught (4) and (2) being missed when the 4-pill set was simplified to 3.

**How to apply:** when changing worker states, grep `worker/state`, `WORKER_STATES`, `STATUS_CONFIG`/`STATE_CONFIG`, and `workerState.state ===` to hit every site, then re-run `bash mobile/scripts/typecheck.sh` + `npm run check`.
