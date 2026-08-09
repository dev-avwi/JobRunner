---
name: Android card halo + job-detail double header
description: Two recurring Android-only mobile UI bugs in JobRunner and their fixes
---

## Android "broken card" gray halo (light & dark mode)
Cards that look broken/haloed on Android (and only Android) are caused by RN
`elevation` in the shared shadow tokens (`mobile/src/lib/design-tokens.ts`
`shadows`). On translucent/tinted card backgrounds the elevation renders a gray
box/halo instead of a soft shadow.

**Rule:** keep card-level shadow tokens (`xs`, `sm`, `md`) at `elevation: 0` on
Android and let the card border provide separation. Only floating surfaces
(`lg`, `xl`, modals, FABs, `header`, `nav`) should keep Android elevation.
iOS `shadowColor/Opacity/Radius` are untouched — they don't have this problem.

**Why:** the design wants subtle depth, but Android elevation + non-opaque card
bg = ugly halo. Borders already separate the cards, so elevation is redundant.

**How to apply:** if a user reports "cards look broken on Android" app-wide,
fix it centrally in the shadow tokens, not per-screen. Cards across the app
(payment-hub KPIs, action-center stat/action cards, jobs KPI/job cards) all pull
from these tokens.

## Job detail (`app/job/[id].tsx`) header too tall on Android
The job screen renders the global `<Header/>` (from `app/_layout.tsx`, always on)
AND a native expo-router Stack header → two stacked bars → big empty white space
pushing content down. `headerStatusBarHeight: 0` alone did NOT fully fix it.

**Fix:** on Android set `headerShown: Platform.OS !== 'android'` on the
Stack.Screen blocks and render an in-content nav row (Back + edit/more actions)
at the top of the screen's `fixedHeader`, reusing the same handlers/permission
flags the native `headerRight`/`headerLeft` used. iOS keeps the native header.

**Why:** the global header already gives top chrome; the native stack header is
a redundant second bar on Android. Custom in-content row = one bar, no gap.

**How to apply:** any detail screen that shows both the global Header and a
native Stack header will double-stack on Android. Prefer hiding the native one
on Android and putting Back/actions in content.

**Generalization (all platforms):** the global `<Header/>` is ALWAYS on, so ANY
`more/` screen that sets `Stack.Screen options={{ headerShown: true }}`
double-stacks on iOS too — shows a big blank top gap, looks "broken/too wide".
The `more/_layout.tsx` default is `headerShown: false`; screens that override it
to `true` are the bug. Fix = `headerShown: false` + an in-content header row
(TouchableOpacity/PressableRow back button with `chevron-left`, centered title,
`headerRight` spacer width 36), copying `create-job.tsx`. No extra top safe-area
inset needed — the global header already owns it. Offenders fixed: the
subcontractor invoicing flow (`subbie-bill.tsx`, `subbie-earnings.tsx`).

## Grid cards collapsing to 1 column
KPI/grid cards sized from `useContentWidth()` math collapse to a single column
because the page container is capped at `OPTIMAL_CONTENT_WIDTH` (usePageShell)
while the card width was computed from the raw (wider) content width → cards too
wide → wrap to 1 per row. **Fix robustly with percentage widths** (`width: '48%'`
in a `flexDirection:'row' + flexWrap + gap:spacing.sm` container) like
`app/more/payment-hub.tsx` does, instead of pixel math. For a standalone
`const`, use `'48%' as const` so it satisfies RN `DimensionValue`.
