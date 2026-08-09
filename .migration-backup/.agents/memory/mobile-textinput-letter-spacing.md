---
name: Mobile TextInput placeholder letter-spacing spread
description: RN TextInputs render placeholder/text with large letter-spacing on device unless letterSpacing:0 + textAlign:'left' are set explicitly.
---

On the JobRunner RN/Expo app, some `<TextInput>` placeholders render on-device with
large letter spacing (e.g. "S e a r c h   c o n v e r s a t i o n", overflowing/cut
off on the right — i.e. left-aligned but widely tracked). No `textAlign:'justify'`,
no RTL/I18nManager, and no `Text/TextInput.defaultProps` exist in the codebase, and
the shared `typography.body` style has no `letterSpacing` — yet the spread still
appears at runtime on certain inputs.

**Fix (empirically proven):** set `letterSpacing: 0` AND `textAlign: 'left'`
explicitly on the affected TextInput style. The jobs.tsx search input was fixed this
way first and renders correctly; inputs that lack the explicit override (chat-hub
search, subbie-bill inputs) showed the spread.

**Root-level mitigation:** added `letterSpacing: 0` to `typography.body` and
`typography.bodySemibold` in `mobile/src/lib/design-tokens.ts` — these are spread
into most inputs, so this normalizes the common case in one place. Inputs that use
literal styles (not spreading typography) still need the explicit `letterSpacing: 0`
+ `textAlign:'left'` added per call-site.

**Why:** the exact runtime source of the inherited spacing was never found in source
(possibly an OS/font-rendering quirk on the user's iOS build). Explicit
`letterSpacing: 0` overrides whatever leaks in; it's the default value so it can only
normalize, never spread. Safe, low blast radius.

**How to apply:** when a user reports "weird/spread-out placeholder or input text"
on mobile, don't dismiss as stale-build — add explicit `letterSpacing: 0` +
`textAlign: 'left'` to that input's style (and check it spreads `typography.body`,
which already carries `letterSpacing: 0`).
