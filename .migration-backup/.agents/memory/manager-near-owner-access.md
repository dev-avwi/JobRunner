---
name: Manager near-owner access
description: How managers get business-wide visibility and team edit rights across server + mobile.
---

Rule: managers get owner-like read access via the permission alias `manage_team → view_all` in server/permissions.ts PERMISSION_ALIASES (expandPermissions is additive). Do NOT alias `assign_jobs → view_all` — an assign-only role must not gain client PII / all-jobs visibility (architect flagged this as an over-grant; it was reverted).

**Why:** managers need to see every job/client to run the crew, but aliases apply to EVERY role and custom-permission set containing that key, so only alias off the explicit manager capability (manage_team).

**How to apply:**
- Server gates should check permissions (`manage_team`, `view_all`, `*`), never role-name regexes.
- /api/team/my-role returns `roleName` (e.g. "Manager") for members, NOT `role` — mobile code reading `data.role` resolves to '' for managers and hides UI.
- Mobile team-management uses `currentUserCanManage` (owner or /manager|admin|supervisor/i on the resolved role) for member edit/invite/location controls, invite codes, custom permissions and subcontractor invoices.
- Server team-member write routes are ownerOrManagerOnly (= MANAGE_TEAM), so managers can invite/edit/remove members.
- Also manager-open (2026-07-19): invite codes (GET/POST/DELETE), member custom permissions PATCH, roles, business subcontractor-invoices GET/PATCH-status. These route bodies must scope by `req.effectiveUserId || req.userId` (ownerOrManagerOnly sets effectiveUserId to the owner) or a manager sees an empty list / 403. Subscription + billing lifecycle routes stay ownerOnly.
