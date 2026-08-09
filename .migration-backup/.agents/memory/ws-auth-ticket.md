---
name: WebSocket auth uses single-use tickets
description: Why /ws/location auth needs the /api/ws-ticket flow and how to keep it working
---
The web app is Bearer-token-only (no jobrunner.sid cookie), but the /ws/location upgrade originally authenticated by cookie only, so every web session failed WS auth with 4001 and the "Reconnecting to live updates" banner stayed forever.

**Why:** Browsers cannot send Authorization headers on a WebSocket upgrade, and raw session tokens must never go in query strings (proxy/APM log leakage).

**How to apply:** Client POSTs /api/ws-ticket (Bearer) to get a 60s single-use nonce, then connects with ?ticket=. Server redeems in authenticateConnection (websocket.ts) before falling back to the cookie session. Any new WS endpoint for web clients must reuse this ticket flow, not cookies or raw tokens.
