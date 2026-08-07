---
name: Private compliance attachment links
description: Opening private compliance object-storage attachments from the web UI requires a signed URL first.
---
Rule: web UI must never render/open private compliance object-storage attachments via plain `<a href>` or `<img src>` — the browser request can't carry the Bearer token, so it 401s. Mint a short-lived signed URL via the authenticated sign-download endpoint first, then open/render that (pre-open the blank tab before the await to dodge popup blockers; for inline images fetch the signed URL into state).
**Why:** direct links silently fail for authorized users because web auth is Bearer-only.
**How to apply:** any UI surface that displays compliance/private attachments.
