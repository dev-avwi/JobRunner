---
name: Sentry noise triage
description: How to read this project's Sentry issues — known noise sources vs real bugs, and the filters that suppress them.
---

Reading Sentry here needs `SENTRY_AUTH_TOKEN` (org `jobrunner`, projects `node-express` + `jobrunner-mobile`): `GET https://sentry.io/api/0/organizations/jobrunner/issues/?statsPeriod=14d`, then `/issues/<id>/events/latest/` for stack traces. The weekly email has no traces — always pull the event.

Known noise patterns (verified 2026-07):
- **"(intermediate value)(...) is not a function"** on jobrunner.com.au = headless-bot scrapers; frames show Playwright internals (`UtilityScript.evaluate`, `addScriptContent`), Chrome-on-Linux, unauthenticated 401 breadcrumbs. Not our code. Filtered in `client/src/main.tsx` beforeSend by frame function names.
- **EADDRINUSE 0.0.0.0:5000 (fatal, high count)** = the dev workspace restarting; server Sentry init used to fire in dev. Now gated `NODE_ENV === "production"` in `server/instrument.ts` — don't remove the gate.
- **"Network request failed"** tagged release `com.jobrunner.app@X` = the MOBILE app losing connectivity (all breadcrumb requests status 0, incl. Stripe telemetry). Note: mobile events can appear under the `node-express` project — check `release`/`device` tags before assuming it's the server.
- **getRegistrationInfoAsync / "Keychain access failed" (may be localized, e.g. Dutch)** = Stripe Terminal reading keychain while iPhone is locked (errSecInteractionNotAllowed). Benign, self-recovers on unlock.

**How to apply:** before "fixing" a Sentry issue, check tags (browser vs release, environment, handled) and the last in-app frame; most low-volume issues here are bot/offline/lock-screen noise, not app bugs.
