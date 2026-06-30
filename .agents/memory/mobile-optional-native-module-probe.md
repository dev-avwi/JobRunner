---
name: Guarding optional Expo native modules
description: How to load an Expo native module that may be missing from an older build without red-screening
---

Some Expo packages (e.g. `expo-document-picker`) call `requireNativeModule('X')` at the
**top level** of their entry module. When the native module is absent from the installed
binary (JS package present, but the app was built before it was added), merely
`require('the-package')` throws *during module-graph evaluation* with
`Cannot find native module 'X'`.

**A `try/catch` around `require('the-package')` is NOT reliable** for this — the error
escaped to the global error handler in practice (Metro module-eval/caching interplay),
red-screening the app even though callers handled a null return.

**Fix:** probe first with `requireOptionalNativeModule('X')` from `expo-modules-core`
(returns `null`, never throws). Only `require` the package if the probe is non-null:

```ts
import { requireOptionalNativeModule } from 'expo-modules-core';
export function getX() {
  if (!requireOptionalNativeModule('ExpoDocumentPicker')) return null; // older build → bail
  return require('expo-document-picker');
}
```

**Why:** the optional probe avoids ever triggering the throwing top-level import.
Callers must degrade gracefully on `null` (e.g. "Update required" alert; keep adjacent
features like photo attach working).

**How to apply:** any time you lazy-load a native-backed Expo module that might not be in
every build. The native module name (`'ExpoDocumentPicker'`) is the string passed to
`requireNativeModule` inside the package's `build/<Name>.js`, not the JS package name.

**Crucial caveat:** this only stops the *crash*. The feature itself still needs a **native
rebuild** (prebuild + run, or a new dev client / EAS build). A JS `git pull` + reload can
never add a native module — see `mobile-dev-sync-model.md`.
