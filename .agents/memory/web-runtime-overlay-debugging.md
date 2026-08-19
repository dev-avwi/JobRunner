---
name: Web runtime overlay debugging
description: The Vite runtime overlay can hide the underlying client exception during browser-agent testing.
---

When the web Vite runtime overlay reports only “unknown runtime error,” do not rely on its displayed stack or the browser testing agent to identify the application error.

**Why:** The overlay may expose only its own `sendError` call and suppress the original page error, making repeated UI-path guesses unproductive.

**How to apply:** Add or use focused client-side error instrumentation around the affected boundary, then reproduce the action in a fresh browser context before changing unrelated data or UI paths.