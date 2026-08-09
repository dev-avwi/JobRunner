---
name: expo-av single-recording orphan across remount
description: expo-av allows ONE prepared Recording per process; an orphan left across a component remount blocks the next record. Keep a module-level handle and only clear it after a successful unload.
---

expo-av permits only ONE prepared `Recording` per process. If a component holding
a recording unmounts (or remounts) without fully unloading, the native recording
is orphaned and the next `prepareToRecordAsync`/create throws errors like
"Only one Recording object can be prepared at a given time" / "only one
recording". If the error string isn't matched, the UI falls through to a generic
alert and recording appears "broken" (notably on Android).

**Rules:**
- Keep a **module-level** handle (`let globalRecording`) set on every create +
  retry-create, so a fresh mount can find and force-unload the orphan.
- On unmount/cleanup, only set `globalRecording = null` AFTER
  `stopAndUnloadAsync()` actually resolves. If unload fails, KEEP the handle —
  otherwise the next mount has no way to clear the orphan and loops on the
  single-recording error.
- Broaden retry-match guards to cover all the limit wordings ("only one
  recording", "prepared at a given time"), and force-unload `globalRecording`
  on the cleanup + retry paths.

**Why:** the original break was an unmatched error string + an orphaned native
recording surviving a remount.
