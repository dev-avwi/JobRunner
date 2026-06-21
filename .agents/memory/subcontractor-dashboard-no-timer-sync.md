---
name: Subcontractor dashboard doesn't sync the timer store
description: Why break/timer state can be stale on the subcontractor dashboard route and how to make it authoritative
---

The mobile `useTimeTrackingStore` `activeTimer` (which carries `isBreak`/`isPaused`) is only kept fresh by the owner Time Tracking widget (`TimeTrackingWidget` in `mobile/app/(tabs)/index.tsx`). That widget does NOT mount on the subcontractor route — the subcontractor route renders `SubcontractorDashboard` instead.

**Lesson:** any feature on the subcontractor dashboard that reads `activeTimer` (e.g. showing the active-job card orange when `isBreak === true`) must call `fetchActiveTimer()` itself (on mount + `useFocusEffect`), or on a cold app start the store stays `null` and the UI shows stale (non-break) state.

**Why:** the dashboard derives its own elapsed timer from `data.activeJob.startedAt` (server value) and never touches the timer store, so break state has no other refresh path on that screen.

**How to apply:** scope break to the shown job with `activeTimer?.isBreak === true && activeTimer?.jobId === activeJob.id` to avoid a false orange when a timer exists for a different job. Break orange = `colors.warning`; the green "Complete" button stays green (white text on a fixed-color bg is correct).
