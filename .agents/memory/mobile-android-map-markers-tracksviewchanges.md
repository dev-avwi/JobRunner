---
name: Android team markers never paint
description: react-native-maps custom-view markers stay invisible on Android when tracksViewChanges=false from first mount
---

On Android, a `<Marker>` with custom child views that has `tracksViewChanges={false}`
set from the very first render NEVER paints — the snapshot is taken before the view
lays out, so the marker is blank/invisible. (iOS renders fine either way.)

**Tell:** other markers on the same map render correctly while one set is missing.
The missing set is the one that hard-codes `tracksViewChanges={false}`; the working
set simply omits the prop (defaults to `true`). Data is fine — the bottom chip
list shows the members and tapping zooms to real coords; only the marker view is gone.

**Why false was there:** it's the iOS fix for the (0,0) flash on first render.
So you can't just delete it.

**How to apply:** gate it per-platform and drive Android off a short-lived state.
Keep a `trackTeamChanges` state (default true), and an Android-only effect that
sets it true then `setTimeout(..., 800)` back to false whenever the marker data or
selection changes. Then `tracksViewChanges={Platform.OS === 'android' ? trackTeamChanges : false}`.
iOS keeps the static `false` (anti-flash) untouched.
