import { requireOptionalNativeModule } from 'expo-modules-core';

// expo-document-picker ships a native module that may be missing from an older
// dev/native build. Its entry (build/ExpoDocumentPicker.js) calls
// requireNativeModule('ExpoDocumentPicker') at the TOP LEVEL of the module, so
// merely `require('expo-document-picker')` throws synchronously during module
// evaluation when the native side is absent. A try/catch around that require is
// not reliable across Metro's module-eval/caching, so instead we probe the
// native module first with requireOptionalNativeModule, which returns null
// (never throws) when it isn't present. Callers must handle a null return by
// degrading gracefully (e.g. prompt the user to update the app, while photo
// attachments keep working).
let documentPickerModule: typeof import('expo-document-picker') | null = null;

export function getDocumentPicker(): typeof import('expo-document-picker') | null {
  if (documentPickerModule) return documentPickerModule;
  // If the native module isn't in this build, bail before requiring the JS
  // package (whose top-level native import would otherwise throw).
  if (!requireOptionalNativeModule('ExpoDocumentPicker')) return null;
  try {
    documentPickerModule = require('expo-document-picker');
    return documentPickerModule;
  } catch {
    return null;
  }
}
