// expo-document-picker ships a native module that may be missing from an older
// dev/native build. Load it lazily so screens never hard-crash at import time;
// callers should handle a null return by degrading gracefully (e.g. prompt the
// user to update the app, while photo attachments keep working).
let documentPickerModule: typeof import('expo-document-picker') | null = null;

export function getDocumentPicker(): typeof import('expo-document-picker') | null {
  if (documentPickerModule) return documentPickerModule;
  try {
    documentPickerModule = require('expo-document-picker');
    return documentPickerModule;
  } catch {
    return null;
  }
}
