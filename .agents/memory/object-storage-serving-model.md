---
name: Object storage serving / access model
description: How /objects/ vs signed-URL serving works and why the open route is safe; what NOT to change.
---

# Object storage access model (JobRunner)

Everything the open route `GET /objects/:objectPath(*)` (server/routes.ts) serves comes from
`PRIVATE_OBJECT_DIR`. There are two distinct serving strategies — do not conflate them:

- **Open `/objects/` route**: authorizes ONLY three chat-attachment prefixes
  (`.private/dm-attachments/`, `.private/team-chat-attachments/`, `.private/chat-attachments/`)
  with business-ownership checks. Non-`.private` paths (`uploads/<uuid>` — logos, etc.) are served
  **unauthenticated on purpose**: they are unguessable UUIDs embedded in PUBLIC contexts (public
  quote/invoice PDFs, business websites, the arrival portal, emails). Requiring auth here BREAKS
  those. Files carry no ACL metadata, so `canAccessObject` would deny-all — do NOT switch this route
  to `canAccessObject`.
- **Signed-URL flow**: job photos (`.private/jobs/...`) and voice notes (`.private/voice-notes/...`)
  are served EXCLUSIVELY via short-lived signed GCS URLs (Replit sidecar
  `/object-storage/signed-object-url`) minted by `requireAuth` + owner-scoped endpoints
  (`photoService.getSignedPhotoUrl`, `voiceNoteService`, `/api/photos`, `/api/jobs/:id/photos`).
  They NEVER go through `/objects/`.
- **Compliance files (`.private/compliance/{businessOwnerId}/<uuid>.<ext>`)**: a FOURTH authorized
  `/objects/` prefix, but gated to owner + managers only (`canAccessComplianceFile` = getUserContext,
  `effectiveUserId === ownerIdInPath` (= `entityId.split('/')[2]`) AND (isOwner || MANAGE_TEAM)).
  Workers — INCLUDING a doc's `holderUserId` — are intentionally blocked from the file. Uploads go
  through `/api/upload` with `type==='compliance'`: that route ALSO gates upload to owner/manager and
  writes the no-leading-slash path (self-consistent with storage write/read). **Compliance upload must
  fail closed** — its `data:` URL fallback is disabled (503 on storage failure) so a degraded upload
  can't bypass `/objects/` authz. Mobile in-app browser can't send the Bearer token, so it calls
  `POST /api/objects/sign-download` (requireAuth, same `canAccessComplianceFile` gate) to mint a signed
  URL, then opens it. Web `<img>/<a>` to `/objects/` authenticate via the express-session cookie
  (resolveOptionalUser checks cookie first), so no web change was needed.
  **Caveat:** legacy already-uploaded compliance files live on the OLD open path
  (`compliance/{userId}/...`, non-`.private`) — they stay publicly served; no migration was done.

**Rule (default-deny):** in the `/objects/` handler, any `entityId` starting with `.private/` that
is not an authorized prefix (the three chat prefixes, or `.private/compliance/` which adds its own
auth gate) returns 404 before serving.
**Why:** stops a new sensitive `.private/*` category from leaking by default if someone adds a prefix
to storage but forgets to authorize it here. Safe because non-chat private data uses signed URLs, and
public assets are non-`.private`.
**How to apply:** the route canonicalizes first (decode once, strip leading slashes, collapse `//`)
so `//`, `%2F`, mixed-slash variants can't bypass the prefix check. Keep that canonicalization.
