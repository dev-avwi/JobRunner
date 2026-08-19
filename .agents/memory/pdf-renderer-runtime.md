---
name: PDF renderer runtime
description: Runtime dependency required for server-side Puppeteer PDF generation
---

Keep Chromium available through the workspace Nix packages whenever the API uses Puppeteer to generate PDFs.

**Why:** Puppeteer is installed without a bundled browser in this environment. Without the system Chromium binary, PDF routes fail at launch and return a generic generation error.

**How to apply:** Retain the Chromium Nix dependency when changing runtime configuration, and verify a PDF route returns a non-empty `%PDF` response after PDF-service changes.