---
name: Mobile has no general websocket event bus
description: Why server broadcasts don't live-update most mobile screens, and the fix pattern.
---
The mobile app has NO shared websocket/event-bus hook. The ONLY raw WebSocket in
`mobile/` is `app/(tabs)/map.tsx` (a location-only socket). Server
`broadcast*Change` calls (e.g. `broadcastWorkerStateChange` / business-user
broadcasts) therefore reach NO listener on ordinary screens.

**Consequence:** a screen that shows data another user/device can mutate will look
"broken / not syncing" even when the server write is 100% correct, because it only
fetches on mount + manual pull-to-refresh. (Real case: owner Team Operations board
showed a subbie as "Available" after they tapped "Busy" — the worker_states row WAS
'busy' in prod DB; the screen just never re-read it.)

**Fix pattern (no WS infra needed):** add `useFocusEffect` (from expo-router) that
refetches on focus AND starts a `setInterval` poll (~20s) while focused, clearing it
on blur. Remove any now-redundant mount `useEffect(fetchData)`. Guard `fetchData`
with an `isFetchingRef` so polls can't stack overlapping requests on slow networks.

**Why:** building a real WS subscription would require tracing/standing up an event
bus this app doesn't have; focus-refetch + poll is the "work basic" solution that
fits the existing fetch-on-mount screens.
**How to apply:** any owner/live-ops/dashboard mobile screen reflecting cross-user
state. Don't rely on the server broadcast alone to update mobile UI.
