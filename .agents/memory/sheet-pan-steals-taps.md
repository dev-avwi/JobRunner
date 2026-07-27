---
name: Bottom sheet drag-to-dismiss steals taps
description: AppBottomSheet PanResponder threshold too low cancels normal taps on rows inside the sheet (blind first tap).
---

Rule: the shared AppBottomSheet drag-to-dismiss PanResponder must only claim a touch for a CLEAR downward swipe. A normal finger tap drifts a few px; a low move threshold (was dy>8, ratio 1.5) steals the touch, cancels the row's press mid-tap, and the sheet dips and springs back — user sees a "blind" first tap that needs repeating (reported in the Tap to Pay job/invoice picker).

**Why:** PanResponder move-negotiation can take the responder away from a TouchableOpacity child once the threshold is met, cancelling the press.

**How to apply:** current gate is `g.dy > 24 && |dy| > |dx|*2` — no velocity gate (a vy requirement blocks slow deliberate drags from ever capturing, so dismiss breaks). If taps inside any sheet ever feel "eaten", check this threshold first, not the screen's handlers.
