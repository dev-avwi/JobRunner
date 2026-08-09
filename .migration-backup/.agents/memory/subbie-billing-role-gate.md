---
name: Subcontractor billing routes role gate
description: Membership alone must not authorize /api/subcontractor billing writes
---
Both subbie billing writers (POST /api/subcontractor/invoices and /api/subcontractor/billing-documents) accept custom line items with arbitrary amounts and no job/time-entry anchor.

**Why:** the original gate was active team membership only, so any worker/office member could invoice the owner arbitrary amounts once custom items landed (architect flagged it, fixed 2026-07-24).

**How to apply:** any new /api/subcontractor/* write route must resolve membership.roleId → user_roles.name and require it to include 'subcontractor' (case-insensitive), not just check teamMembers.isActive. Test with worker@jobrunner.com.au (worker123) expecting 403 and dave.sub@demoplumbing.com.au (subbie123) expecting success.
