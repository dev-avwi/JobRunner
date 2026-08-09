---
name: runTest canonical URL maps to dead port
description: Why runTest 502s in this repl and the TCP-forwarder workaround
---

# runTest canonical URL maps to a dead local port

The testing subagent (`runTest`) drives the app via the canonical external URL
(port 80/443). In this repl that URL maps (via `.replit` `[[ports]]`) to a stale
local port (seen: **23636**) left behind by a removed mockup-sandbox/design
artifact. Nothing listens there, so `runTest` gets **502** for every step.

**Why it's confusing:** the dev app is healthy on `localhost:5000`; only the
external mapping is broken. `.replit` `[[ports]]` is auto-managed and cannot be
hand-edited; the stale entry is supposed to clear once nothing binds the port.

**Workaround (temporary, remove when done):** run a tiny Node TCP forwarder
`23636 -> 5000` as a `console`-type workflow so the canonical URL resolves and
`runTest` works. Tear it down at the end (`removeWorkflow` + delete the script)
so nothing stays bound to 23636.

**Update 2026-07: the mockup-sandbox artifact is BACK and owns 23636.** Its
platform-managed workflow ("Component Preview Server", defined in
`artifacts/mockup-sandbox/.replit-artifact/artifact.toml`) auto-restarts and
reclaims the port, so an ad-hoc TCP forwarder gets steamrolled. Working fix:
temporarily add a vite proxy to `artifacts/mockup-sandbox/vite.config.ts` —
`server.proxy: { "^/(?!__mockup)": { target: "http://127.0.0.1:5000", ws: true } }`
— restart the mockup workflow, run tests, then REVERT the config and restart
again. Don't pkill the vite process; the workflow supervisor restarts it.

**Bigger gotcha — 429 false failures:** even with the forwarder, `runTest` does a
**full page reload per route**, refiring `/api/auth/me` + prefetch + all page
queries ~16x in seconds through the single forwarder hop. This trips the
per-user **429 rate limiter** (a real production-hardening feature), and the
SPA's auth gate then renders the **public LandingPage** on a random
authenticated route. This is an ENV artifact, not a product bug — normal SPA use
caches `/api/auth/me` (staleTime 5min) and navigates client-side.

**How to apply:** when a signed-in route intermittently shows the marketing
homepage only under `runTest`, suspect 429/forwarder, not the route. Verify the
real behavior with direct `curl` against `localhost:5000` (Bearer token), pace
the test (waits + reload-once-on-marketing), and don't "fix" the app for it.
