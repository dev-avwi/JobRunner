---
name: Three separate worker-status stores (availabilityStatus vs worker_states vs team_presence)
description: Why a subcontractor's Available/Busy/Unavailable pill doesn't show on the owner's Team Operations board
---
Worker "status" is stored in THREE unrelated places and they do NOT auto-sync:
1. `teamMembers.availabilityStatus` ('available'|'busy'|'unavailable') — written by the **subcontractor dashboard** pills via `PATCH /api/subcontractor/availability-status`.
2. `worker_states.state` ('available'|'on_job'|'travelling'|'break'|'delayed'|'needs_help'|'busy'|'unavailable') — written by `/api/worker/state` and `autoUpdateWorkerState` (time-entry start/stop). **This is what the owner's Team Operations / Live Ops board reads** (`GET /api/team/worker-states`, mobile `team-operations.tsx` `ws.state`).
3. `team_presence.status` ('online'|'offline'|'busy'|'on_job'|'break') — online/offline heartbeat, used as a fallback.

**Why:** The subbie pill only wrote store #1, but the owner board reads store #2 → owner always saw "Available" no matter what the subbie picked. Fix was to make the availability PATCH also `upsertWorkerState` + `broadcastWorkerStateChange` for every active membership (subbie can belong to multiple businesses), mapping the 3 subbie values 1:1 (all are valid worker_states).

**How to apply:** Any new place that sets or reads "is this worker available/busy" must pick the RIGHT store for its consumer, or mirror across stores. Owner-facing presence = `worker_states`. `autoUpdateWorkerState` currently only resolves ONE membership (`getTeamMembershipByMemberId`) so it can miss other businesses for multi-business subbies. Manual availability can transiently clobber an `on_job` worker_state until the next auto transition — acceptable, and the owner pill still prioritises an active assigned job over the raw state.
