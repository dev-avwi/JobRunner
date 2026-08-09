---
name: CodeQL alert remediation patterns
description: How the recurring GitHub CodeQL code-scanning alert classes on this repo were fixed, plus which ones are genuine false positives to dismiss.
---

# CodeQL remediation patterns (server/)

Fix patterns that satisfy CodeQL's taint/dataflow queries on this codebase. Apply these
shapes exactly — partial mitigations (e.g. validating a derived value but still using the
raw tainted one) do NOT clear the alert.

## Insecure randomness (biased modulo)
- Symptom: `chars[bytes[i] % chars.length]` after `const bytes = randomBytes(N)`.
- Fix: delete the `randomBytes` line and index with an unbiased `randomInt(chars.length)`.
  `routes.ts` has a top-level `import { randomInt } from 'crypto'`; dynamic-import / module
  sites use `crypto.randomInt(...)`. Token generators live in routes.ts (payment + receipt
  view tokens), storage.ts (quote-accept token), emailRoutes.ts (payment token).

## Externally-controlled format string
- Symptom: user value (req.params/req.body — invoiceId, quoteId, configId, vapi call.id/
  toolName) interpolated into the FIRST arg of `console.*`.
- Fix: make the first arg a CONSTANT literal with `%s` placeholders; pass the tainted value
  as a later argument. Only the req-sourced var is tainted — DB-sourced siblings on adjacent
  lines (e.g. `invoiceWithItems.jobId`) are NOT flagged, so don't churn them.

## SSRF via URL path interpolation (constant host)
- Symptom: an id (QBO realmId/invoiceId) interpolated into a fetch URL whose host is constant.
- Fix: validate the id with `/^\d+$/` AND `encodeURIComponent` it before interpolation
  (belt + braces). QBO ids are numeric so encoding is a functional no-op.

## Type confusion via parameter tampering
- Symptom: `const x = req.query.q as string`. `req.query.q` can be string|array|object.
- Fix: `const q = req.query.q; if (typeof q !== 'string' || ...) return ...;` — a real
  `typeof` guard, never an `as string` cast.

## Host-header poisoning (email link generation)
- Source: `req.get('host')` in `urlHelper.ts` getProductionBaseUrl; sink: generated email html.
- **Don't** just delete the req-host dev fallback outright — architect flagged that as a
  functional regression for non-Replit/tunnel dev (links hardcode localhost).
- **Do** trust req host ONLY when it's a member of the env-configured allowlist
  (`REPLIT_DOMAINS.split(',')`). `allowlist.includes(host)` is a CodeQL-recognized barrier
  AND env-derived list is trusted input. Production path already never uses req host
  (APP_DOMAIN → VITE_APP_URL → hardcoded apex).

## Genuine false positive — DISMISS in GitHub, do not "fix"
- routes.ts voice-note audio-transcribe `fetch(audioUrl)` (SSRF). It already enforces
  https-only + a hostname allowlist (storage.googleapis.com, storage.cloud.google.com,
  *.replit.dev / *.repl.co) BEFORE the fetch. CodeQL flags it because the guard runs on the
  parsed `parsedUrl.hostname` while the fetch is made with the raw `audioUrl` string, so it
  can't link the barrier. **Do NOT reconstruct the URL from parsed parts** — that re-encodes
  the path/query and corrupts signed GCS URL signatures. Mark it "won't fix / false positive".
