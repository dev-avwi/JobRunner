---
name: Object storage read-URL signing must use the sidecar, not GCS SDK
description: Why gcsFile.getSignedUrl fails on Replit object storage and what to use instead
---

# Signing private object read URLs

Replit object storage authenticates via a **token-based sidecar** with NO
service-account `client_email`. The GCS SDK's `gcsFile.getSignedUrl({action:'read'})`
(and PUT/etc) needs a `client_email` to self-sign, so it throws
**`Cannot sign data without \`client_email\``** at runtime.

**Object reads/writes through the SDK still work** (`gcsFile.save()`,
`file.exists()`, `createReadStream()`) because those use the sidecar token. Only
URL *signing* via the SDK is broken.

**Rule:** to hand a client a short-lived signed URL for a private object, sign via
the Replit sidecar endpoint (`signObjectURL({method:'GET'|'PUT'})` in
`server/objectStorage.ts`, which POSTs to `${SIDECAR}/object-storage/signed-object-url`).
For a raw bucket-qualified key, use `ObjectStorageService.getSignedReadURLFromKey(key, ttlSec)`.

**Why:** caught by an e2e check — every job-document upload (`POST /api/jobs/:jobId/documents`)
returned 500 *after* the file + DB row were saved, because it signed the response
`fileUrl` with `getSignedUrl`. The GET-list and `/view` routes had the same bug.
`photoService` survived only because it tries the sidecar first and falls back to
`getSignedUrl` (the fallback would also fail, but the sidecar path normally wins).

**How to apply:** any NEW code that returns a signed object URL must go through the
sidecar signer. Never reach for `gcsFile.getSignedUrl` on this platform — it
compiles and passes typecheck (esbuild skips types) but fails at runtime.
