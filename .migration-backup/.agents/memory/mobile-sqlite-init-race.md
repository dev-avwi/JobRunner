---
name: Mobile offline SQLite init NPE
description: Why expo-sqlite throws NativeDatabase.prepareAsync/execAsync NullPointerException on Android offline-storage init, and the de-dupe fix
---

# Offline storage SQLite init NullPointerException (Android)

Symptom (dev LogBox red overlays): `[OfflineStorage] Initialization failed` /
`Migration error` / `Failed to initialize offline storage` →
`Call to function 'NativeDatabase.prepareAsync' (or execAsync) has been rejected.
→ Caused by: java.lang.NullPointerException`.

**Root cause (real, not just emulator):** `offlineStorage.initialize()` (in
`mobile/src/lib/offline-storage.ts`) had no concurrency guard. React strict-mode /
screen re-mounts fire it twice; two parallel `SQLite.openDatabaseAsync(...)` calls
race and one ends up with a null native DB handle. The next `execAsync`/`prepareAsync`
on that null handle is what throws the NPE.

**Fix:** singleton in-flight guard — `if (this.db) return; if (this.initPromise) return this.initPromise;`
store `this.initPromise = this._initialize()`, and on failure reset `initPromise = null`
so a later call can retry. Body moved to private `_initialize()`. Also added a single
retry around the first `openDatabaseAsync` (transient cold-start NPE) and `this.db = null`
in the catch.

**Why:** concurrent opens are the durable trap; a shared init promise serializes them.

**Logging rule (architect-approved, applies app-wide):** gracefully-handled fallbacks
(offline init/migration failures → app falls back to live server data) must be
`console.warn` (DEV-guarded), NOT `console.error`, so they don't pop the red LogBox
during `npx expo run:android`. These are caught and non-fatal.

**Deploy note:** these are JS-only changes — user just needs `git pull` + Metro reload
on their Mac clone (no `expo prebuild`/native rebuild required).
