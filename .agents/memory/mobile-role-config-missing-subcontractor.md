---
name: Mobile role label falls back to Worker
description: Why a correctly-joined subcontractor (or any role) shows the wrong badge in the mobile Team Members screen
---

The mobile Team Members screen (`mobile/app/more/team-management.tsx`) maps a member's role to a badge label/icon/color via a single `ROLE_CONFIG` object. Both the member card (`ROLE_CONFIG[member.role] || ROLE_CONFIG.worker`) and the details modal (`ROLE_CONFIG[selectedMember.role]?.label || 'Worker'`) silently fall back to **Worker** when the key is missing.

Server `GET /api/team/members` returns `role` = role name lowercased with spaces→underscores (e.g. `"subcontractor"`, `"office_manager"`) plus the human `roleName`. If a role name normalizes to a key that `ROLE_CONFIG` doesn't have, the badge is wrong even though the DB membership/role is correct.

**Rule:** any role a business can actually assign must have a matching key in `ROLE_CONFIG` (it's the ONLY role-label map in mobile). When a new role/role-name ships, add the key here too.

**Why:** a subcontractor invited via a subcontractor invite code was badged "Worker" — the join was correct in the DB; only this map was missing the `subcontractor` key.

**How to apply:** add the entry (label/color/icon/description) right next to `worker`/`staff`. `getRoleCategory` (owner|manager|worker stat buckets) intentionally compresses unknown roles into `worker` for counts — that's acceptable, not the label bug. Mobile changes only reach devices after a PUBLISH.

**Related class of bug — exact-string role checks:** server `roleName` is the raw DB role name (e.g. `"Manager"`), so any screen doing `roleName === 'MANAGER'` silently fails for real managers (bit time-tracking's team view). Always gate via `useUserRole()` flags (`isManager` matches manager/admin/supervisor case-insensitively), never exact roleName strings.
