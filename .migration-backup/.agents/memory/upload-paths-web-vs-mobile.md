---
name: Upload paths — web vs mobile, servable /objects path
description: Two upload endpoints exist; only /api/upload returns a servable path. The presigned /api/objects/upload pathname is NOT viewable.
---

There are two server upload mechanisms and they are NOT interchangeable for viewing:

- `POST /api/upload` (multer multipart, field `file`) → `ObjectStorageService.uploadFile()` → returns `{ url: "/objects/{type}/{userId}/{uuid}.{ext}" }`. This `/objects/...` path IS servable by the `/objects/:objectPath(*)` route (it prepends PRIVATE_OBJECT_DIR; entityId like `compliance/...` does not start with `.private/` so it isn't default-denied). No fileFilter → accepts PDF/doc. Limit 10MB. Mobile uses this.
- `POST /api/objects/upload` (presigned GCS PUT) → client PUTs the file, then must NORMALIZE the returned GCS URL via `normalizeObjectEntityPath()` (→ `/objects/{entityId}`) before storing. Storing `new URL(uploadURL).pathname` raw is a BUG: that raw GCS pathname is NOT servable by the app and the file can't be viewed later.

**Why:** web `client/src/pages/Files.tsx` compliance upload was storing the raw presigned pathname, so uploaded compliance files were never viewable. Fixed by switching web to `POST /api/upload` (FormData + Bearer via `getSessionToken()`), unifying with mobile on the `{url}` contract.

**How to apply:** for any new file-upload feature, prefer `POST /api/upload` and store the returned `url` directly. If you must use the presigned flow, always pass the result through `normalizeObjectEntityPath()` server-side before persisting. `apiRequest()` (web) only sends JSON — for multipart use a raw `fetch` with `Authorization: Bearer ${getSessionToken()}` and no Content-Type (let FormData set the boundary).

**Privacy note:** `/objects/{type}/{userId}/{uuid}` files are served WITHOUT per-user auth (capability URL — unguessable UUID only). Anyone with the URL can fetch. For truly private docs, route via a `.private/` prefix + auth/ownership check in the `/objects` route like chat attachments.

## Max upload size is a coupled ceiling, not one number

Current per-file cap is **100MB** (raised from 10/50MB to compete with ServiceM8 50MB / Tradify 25MB; Jobber's 500MB needs streaming we don't have). Raising it means changing FOUR coupled things in lockstep — miss one and you get silent rejects or OOM:

1. **multer `fileSize`** on every relevant instance — `generalUpload` (`/api/upload`) AND the shared `upload` (job documents `/api/jobs/:jobId/documents` + job photos/videos). These are separate instances; bump both.
2. **Client pre-checks + display text** — `client/src/components/JobDocuments.tsx` and `client/src/pages/Files.tsx` each have their own size guard + "up to NMB" copy. Mobile has NO client doc cap (inherits the server limit).
3. **The 30s `/api` request timeout** in `server/index.ts` — multipart requests get a longer FINITE timeout (5min), non-multipart stay 30s. Never make it an unbounded bypass (slow-loris).
4. **RAM** — all multer instances use `memoryStorage()`, so each in-flight upload is fully buffered in RAM (+~33% transient for the `/api/upload` base64 fallback). This is bounded by `uploadQueue` (BoundedQueue in `server/concurrency.ts`): a global gate middleware in `server/index.ts` caps concurrent multipart `/api` uploads (~6) and sheds excess with 429+Retry-After. The gate MUST attach res close/finish listeners BEFORE `acquire()` resolves, else an abort-while-queued strands the slot (deadlocks the queue).

Also stale-text trap: `/api/upload` returns a hardcoded "File must be under NMB" on `LIMIT_FILE_SIZE` — update it when you bump the cap.

**Why:** memoryStorage + a big cap is the OOM risk; true 500MB requires streaming straight to object storage (rewrites every upload handler) — out of scope until explicitly requested.
**How to apply:** to change the cap, edit all of (1)+(2)+(3 if the timeout logic changes)+(stale text); leave (4) alone unless raising past ~100MB, then re-tune `uploadQueue` or move to streaming.
