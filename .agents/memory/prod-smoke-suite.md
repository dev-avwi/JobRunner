---
name: Prod smoke suite
description: How the deployed-site smoke suite works — self-provisioned account, exit codes, post-merge budget
---

- Login page is at `/auth` (component `AuthFlow.tsx`, testids `input-login-email` etc.); root `/` is marketing. `AuthForm.tsx` is unused.
- `scripts/prod-smoke.mjs` smoke-tests https://jobrunner.com.au: exit 0 pass / 1 fail / 2 unable / 3 smoke-account-not-yet-provisioned. `--api-only` (~1s) runs from post-merge; full Puppeteer mode runs from the in-server daily scheduler (`server/prodSmokeScheduler.ts`).
- **Why exit 3 exists:** the dedicated account (`prod-smoke@jobrunner.com.au`) is provisioned only by the deployed server (`ensureSmokeAccount()` — dev sandbox cannot write to the real prod DB; NEON_DATABASE_URL is a STALE copy, not prod). Until the next publish, a clean 401/unverified rejection is bootstrap, not outage.
- Smoke password is derived, never stored: `'Sm0ke!' + HMAC-SHA256(SESSION_SECRET, 'prod-smoke-account-v1').hex.slice(0,24)` — same formula in script and scheduler; changing one side breaks login.
- **post-merge.sh has a ~60s total budget** — only fast bounded checks belong there; browser walkthroughs must run elsewhere.
- Bearer auth = raw session `sid` looked up in the `session` table; `/api/auth/login` returns it as `sessionToken`.
