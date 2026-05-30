---
name: Deploy build fails at puppeteer Chrome download
description: Autoscale publish failing "while bundling/building" when local build is clean — puppeteer's install-time Chrome download is the fragile step.
---

# Deploy build fails during install: puppeteer downloads Chrome

**Symptom:** Replit autoscale publish fails during the build/"bundling" phase. `npm run build` succeeds locally (clean exit, modest RAM, all artifacts present) and the `.replit` deploy config is already the known-good one. No deployment *runtime* logs exist because it never reached runtime.

**Cause:** `puppeteer` (v24+) has a `postinstall` (`node install.mjs`) that downloads its own Chrome (~150MB+) from Google's servers during `npm install`. On the deploy builder this network fetch is the most failure-prone step. It works locally only because the browser is already cached. The app does not need it — it runs against the Nix system `chromium` (in `.replit` `[nix].packages`).

**Fix (checked-in, environment-independent):**
- `.puppeteerrc.cjs` at repo root: `{ skipDownload: true, executablePath: <which chromium> }`. `skipDownload` stops the install download; `executablePath` (resolved at runtime via `which chromium`) makes EVERY `puppeteer.launch()` default to the Nix browser.
- `.npmrc`: `puppeteer_skip_download=true` as an npm-install backstop.
- Verify: `node -e "console.log(require('puppeteer').executablePath())"` should print the Nix `/nix/store/...chromium` path.

**Why also pin executablePath in code:** some `puppeteer.launch()` call sites pass no `executablePath` (e.g. WHS PDF routes). They'd otherwise rely on the bundled download. With `skipDownload` on, they must fall back to system chromium — covered by the `.puppeteerrc.cjs` default, and additionally pinned inline for runtime safety. `server/pdfService.ts` already used `which chromium` directly.
