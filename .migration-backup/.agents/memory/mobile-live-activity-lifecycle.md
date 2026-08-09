---
name: Mobile Live Activity lifecycle
description: When the iOS Live Activity (lock screen / Dynamic Island job timer) must start, update, and end.
---

The lock-screen Live Activity mirrors the **active job timer**, not the job status. It is local on-device ActivityKit (`mobile/modules/LiveActivity`, widget target `mobile/targets/JobRunnerLiveActivity`), driven by `start`/`update`/`end` — no push.

**Rule:** every real timer stop MUST end the Live Activity; work↔break transitions MUST keep it alive (flip via `update`, don't end).

**Why:** the activity is anchored in `useStore.stopTimer`. `pauseTimer`/`resumeTimer` call `stopTimer` internally as a transition (work→break starts a break timer that `update('on_break')`s the SAME activity; resume `update('in_progress')`s it). If `stopTimer` blindly ended the activity, the break view would vanish. If it never ended it (the original bug), cancelling/stopping a timer left "IN PROGRESS" stuck on the lock screen until manually cleared.

**Dismissal policy:** native `end()` (`LiveActivityModule.swift`) MUST use `dismissalPolicy: .immediate`. With `.after(date)` the Dynamic Island clears instantly but the Lock Screen card lingers (showing the final "completed" state) for the whole window — users read that as "cancel didn't work". This is a NATIVE Swift change → needs a new EAS/dev build (not JS OTA / Metro reload) to take effect.

**How to apply:** `stopTimer(options?: { keepLiveActivity?: boolean })` ends the activity unless `keepLiveActivity` is set; only the pause/resume transitions pass `keepLiveActivity: true`. All UI stop paths (stop button, switch-job, complete-job, time-tracking) call plain `stopTimer()` and inherit the end. Any NEW path that stops a timer must go through `stopTimer` (don't post `/api/time-entries/:id/stop` directly) so the activity ends. `start` happens on work-timer start (and job→in_progress in `job/[id].tsx`); `end` is also called explicitly in the complete-job flow (redundant but harmless — end on an already-ended activity is a no-op). All calls are fire-and-forget `.catch(()=>{})` — never block the timer.
