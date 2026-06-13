---
name: Mobile confirm dialogs
description: The app already has a platform-aware confirm() hook — use it instead of raw Alert.alert or new dialog components
---

# Use the existing useConfirmDialog() hook for confirmations

The mobile app already ships a global confirmation system in
`mobile/src/components/ui/ConfirmDialog.tsx`:
- `ConfirmDialogProvider` is mounted in `mobile/app/_layout.tsx`.
- `useConfirmDialog()` returns `confirm(options) => Promise<boolean>`.
- It is **platform-aware by design**: iOS uses the native `Alert.alert` (correct
  system typography/blur/destructive red); Android + web use a branded centered
  Modal that respects theme tokens + haptics.

**Why:** users (esp. for "premium feel") want iOS to keep the native alert but
Android's default Alert looks unbranded next to themed sheets. This hook already
solves exactly that. A centered dialog (not a bottom sheet) was the chosen style
so it never overlaps existing AppBottomSheet/ActionSheet sheets.

**How to apply:** for any new confirm/destructive prompt, call
`const confirm = useConfirmDialog();` then
`if (await confirm({title, message, confirmText, cancelText, destructive:true})) { ... }`.
Do NOT write a fresh Alert.alert or a new dialog component.

**Regression caveat (don't force the branded modal on iOS):** this once got
"fixed" by routing every platform through the branded Modal because the iOS
native destructive button looked near-white/invisible. The real cause was a
missing button `style` — iOS draws a `style:'destructive'` button red
regardless of app tint. So always pass `style:'destructive'` (and
`style:'cancel'`) on the native iOS path; do NOT collapse iOS back onto the
branded modal.

**Footgun:** the `write` tool silently overwrites an existing file — before
creating a "new" ui component, grep for the name first. There was already a
ConfirmDialog.tsx; recover an accidental overwrite with
`git show HEAD:<path> > <path>` (a read+redirect, not a destructive git op).
