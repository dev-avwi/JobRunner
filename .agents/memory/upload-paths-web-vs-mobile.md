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
