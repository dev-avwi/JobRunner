---
name: Bearer-only sessions break plain browser navigation to /api routes
description: Any <a href>, window.open(url), or iframe src pointing at a requireAuth /api route 401s for Bearer-token sessions; fix patterns per surface.
---

Web sessions are often Bearer-token-only, so the browser cannot attach auth to plain navigations. Any of these silently 401:
- `<a href="/api/.../pdf">` download links
- `window.open('/api/import/templates/...')`
- `<iframe src="/api/swms/:id/pdf?format=html">`

**Fix patterns** (all in use, WhsHub.tsx / SettingsImportCards.tsx):
- Generated PDFs: `openGeneratedPdf()` — open blank tab synchronously (popup-blocker safe), `apiRequest('GET', path)` → blob → set tab location; revoke blob URL after ~60s; toast on failure.
- Iframe previews: `AuthedPdfFrame` component — fetch with auth → blob URL as iframe src, revoke on unmount.
- File downloads: fetch with `getAuthHeaders()` → blob → temp `<a download>` click.
- Object-storage attachments: POST /api/objects/sign-download then open signed URL (see compliance-attachment-links.md).

**Why:** repeated bug class; three separate incidents (Files page, compliance attachments, WHS PDFs/templates).
**How to apply:** never add a plain link/iframe/window.open to a protected /api route; grep for `href={\`/api/` and `window.open(\`/api/` when auditing. Playwright note: a pending file chooser blocks window.open — test popups in a clean context.
