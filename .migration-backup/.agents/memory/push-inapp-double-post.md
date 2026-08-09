---
name: Push + in-app notification double-post
description: sendPushNotification creates an in-app bell entry by default; pairing with createNotification duplicates.
---

`server/pushNotifications.ts` `sendPushNotification(options)` calls `storage.createNotification(...)` itself unless `options.skipInAppNotification === true`.

**Why:** If a route wants control over the in-app entry (custom type/priority/relatedId) it will call `storage.createNotification` directly AND `sendPushNotification` for the push — without `skipInAppNotification` that produces two bell entries for one event.

**How to apply:** When you call both in the same handler, pass `skipInAppNotification: true` to `sendPushNotification`. If you only call `sendPushNotification`, leave it off so the bell entry is still created.
