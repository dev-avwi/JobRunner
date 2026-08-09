---
name: iOS 26 empty headerRight glass circle
description: Why an empty native-stack headerRight shows a hollow circle on iOS 26 and how to avoid it
---

On iOS 26 (Liquid Glass), react-native-screens/native-stack wraps ANY non-null
`headerRight`/`headerLeft` element in a circular glass capsule. So a `headerRight`
that returns an empty `<View>` (e.g. all action buttons gated off for a role)
renders as a hollow, non-responsive grey circle next to the Back button.

**Rule:** When a header button slot has no visible children for the current
role/state, return `null` from the `headerRight`/`headerLeft` function — never an
empty container.

**Why:** An empty View is non-null, so iOS still allocates the glass capsule.
Returning `null` tells the native header there is no item, so nothing renders.

**How to apply:** Compute the per-role visibility flags first; if none are true,
`return null` before returning the wrapper View. (Seen on the mobile job detail
screen headerRight, where workers had edit/more gated off.)
