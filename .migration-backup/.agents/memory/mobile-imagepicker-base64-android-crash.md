---
name: Image picker base64:true crashes Android
description: expo-image-picker base64:true causes Android ANR / BadParcelableException; read base64 from the file URI afterward instead.
---

Passing `base64: true` to `ImagePicker.launchCameraAsync` / `launchImageLibraryAsync`
on Android is a crash risk: the encoded image is returned inline through the
Activity-result Intent (can exceed the Binder transaction limit) and the whole
image is held in memory, which makes the OS more likely to kill the app process
while the picker is foregrounded — surfacing as an ANR or
`android.os.BadParcelableException` on return.

**Fix / rule:** never use `base64: true`. Pick to a file URI, then read base64
after the fact:
```ts
import * as FileSystem from 'expo-file-system/legacy';
const base64 = await FileSystem.readAsStringAsync(asset.uri, {
  encoding: FileSystem.EncodingType.Base64,
});
```
(`expo-file-system/legacy` is the import style used across this repo for v19.)

**Why:** lower memory pressure + no giant Intent payload = far less chance of
process death mid-pick.

**How to apply:** any new image-picker call that needs base64. Note the pure
process-death case (no base64, just low memory while picker is foreground) is a
native Expo limitation and is NOT fully fixable from JS — set that expectation.
