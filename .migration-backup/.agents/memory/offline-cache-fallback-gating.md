---
name: Offline cache fallback gating
description: Mobile detail screens reading SQLite cache when network fails — how to gate the fallback safely.
---
Mobile api.get returns `{error:'offline', isOffline:true}` when disconnected; all other errors (401/403/404/5xx) also come back as `{error}`.

**Rule:** any screen that falls back to offlineStorage cached data on fetch failure must check `response.isOffline === true`, never just `response.error`.
**Why:** falling back on any error shows cached job/client data the server just DENIED (403/404) — a UI-level access-control leak with stale data.
**How to apply:** job detail got this fallback (getCachedJob/getCachedClient); invoice/quote/client detail screens still lack any offline fallback — apply the same gated pattern if added. CachedJob is a subset of Job: set derived state (portalEnabled etc.) to safe defaults on the cache path. Team members are NOT cached offline (in-memory only) — assign sheets show empty offline by design.
