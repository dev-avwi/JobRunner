---
name: Mobile modal primary button white-on-white
description: Button variant="brand" renders white-on-white on iOS modal footers; use SheetButton (TouchableOpacity) instead.
---

The shared `Button` component's `variant="brand"` (Pressable-based, even with a hardcoded blue bg + white text) does NOT reliably paint its background — primary actions come out white-on-white. The code looks correct, so this is not discoverable by reading it. First seen on iOS modal/bottom-sheet footers; ALSO confirmed on an **inline card action on Android** (the "Invoice" button on COMPLETED job cards in `mobile/app/(tabs)/jobs.tsx`) — so the bug is not modal-only. There the fix was a self-contained `Pressable` with explicit hardcoded `#2563EB`/pressed `#1D4ED8` bg + white Feather icon + white `Text` (no theme tokens needed since it's a fixed brand-blue action).

**The reliable recipe** (proven first by the "Post Update" button in `mobile/app/job/[id].tsx`): a plain `TouchableOpacity` with explicit `backgroundColor: colors.primary` + `Text`/icon color `colors.primaryForeground`, `paddingVertical: spacing.md`, `borderRadius: radius.lg`, `minHeight: 48`. This is now packaged as `mobile/src/components/ui/SheetButton.tsx` (variants: `primary` | `outline`; props: label/children/icon/trailingIcon/loading/disabled/fullWidth/style).

**How to apply:** for any modal / bottom-sheet primary action button, use `SheetButton`, NOT `<Button variant="brand">`. Cancel buttons use `SheetButton variant="outline"`. As of this fix all `variant="brand"` call sites were migrated to `SheetButton`; the brand variant is left in `Button.tsx` but unused — don't reintroduce it for sheet/modal actions.

**Why:** colors come from `colors.primary` (business brand colour) + `colors.primaryForeground` (auto safe-contrast) via `useTheme()`; spacing/radius from `mobile/src/lib/design-tokens.ts`.
