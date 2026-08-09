---
name: Mobile Android native-component gotchas
description: Two recurring Android-only RN pitfalls in the JobRunner mobile app — DateTimePicker reopen loop and nested native-header double status-bar gap.
---

## DateTimePicker reopen loop (Android)
`@react-native-community/datetimepicker` on Android is a **native modal dialog**, not an inline control — `display="spinner"` does not make it inline. If `onChange` does not clear the React visibility flag, the picker re-mounts every render and Android reopens the dialog forever (inescapable).

**Rule:** every `<DateTimePicker>` must do `setShow...(Platform.OS === 'ios')` in `onChange`, use `display={Platform.OS === 'ios' ? 'spinner' : 'default'}`, gate any inline "Done" button to iOS only, and only apply the value when `event.type !== 'dismissed'`.
**How to apply:** the correct reference pattern lives in `app/more/expenses.tsx` and `app/more/time-tracking.tsx`. Copy it; don't invent a variant.

## Nested native header → double status-bar gap (Android)
The global `<Header />` (app/_layout.tsx) already applies `paddingTop: insets.top`. Any screen that ALSO sets its own native `<Stack.Screen options={{ headerShown: true }}>` gets a SECOND status-bar height reserved by the native header on Android (edge-to-edge), producing a phantom empty gap that pushes content "too low". iOS does not show this gap.

**Rule:** for a screen with a nested native header under the global Header, set `headerStatusBarHeight: 0` on Android only.
**How to apply:** expo-router's option type omits `headerStatusBarHeight` (valid native-stack option), so inject via spread cast: `...(Platform.OS === 'android' ? ({ headerStatusBarHeight: 0 } as any) : {})`. Apply to ALL Stack.Screen blocks in the file (loading + main render), not just one.
