---
name: Mobile "feature broken" caused by stale prod deploy
description: When the mobile app reports a feature broken / "not joined" but data is correct, suspect the live prod backend is older than the app.
---

When the mobile app shows a feature as broken (e.g. "not joined to business", billing fails) but the underlying data is correct (dashboard shows the membership, DB rows are active+accepted), suspect a **stale production backend**, not a data/code bug.

**Why:** The mobile app's `PROD_FALLBACK` (mobile/src/lib/api.ts → https://jobrunner.com.au) points at the *deployed* server. App releases can ship ahead of the last publish, so the app calls endpoints the live server doesn't have yet → 404s that surface as confusing "not joined"/feature-missing UI.

**How to apply:** Probe prod endpoints directly before changing code. A quick tell: new endpoints return 404 on prod while old ones (e.g. `/api/health` 200, an older auth route 401) work. Example from one incident: `/api/subcontractor/completed-jobs` and `/api/subcontractor/billing-documents` were 404 on prod but existed in source. Fix = user must **publish** (additive schema migrations apply on publish); no source change repairs a stale deploy. Distinct from `mobile-dev-sync-model.md` (that's the user's *local* Metro clone being stale; this is the *deployed* server being stale).
