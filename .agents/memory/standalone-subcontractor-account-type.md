---
name: Standalone subcontractor labelling
description: How a person who signs up as "subcontractor" with NO business/team membership gets labelled "Subcontractor" instead of owner/team-member.
---

A standalone subcontractor = signed up choosing "subcontractor" but never redeemed a business invite, so they have ZERO accepted `team_members` rows. Before the fix, `/api/team/my-role` fell into its owner-fallback branch and returned a plain owner with no `roleName`, and the mobile badge defaulted to "Team member".

**The mechanism:** `business_settings.accountType` ('business' default | 'subcontractor'). The mobile onboarding subcontractor flow persists `accountType:'subcontractor'`. `/api/team/my-role`'s owner-fallback (non-member) branch reads it and, when subcontractor, adds `roleName:'Subcontractor'` + `isSubcontractor:true` to the response **while keeping `role:'owner'` and `isOwner:true`**.

**Why isOwner stays true:** a standalone sub still owns their own solo data (jobs/quotes/invoices they create); flipping access control would lock them out. Only the LABEL + which dashboard renders change, never RBAC.

**How to apply / invariants:**
- Membership ALWAYS wins: if an accepted `team_members` row exists, my-role returns the membership role and never looks at `accountType`. So a sub who later joins a business is correctly relabelled by their membership.
- Mobile is backend-driven: `(tabs)/index.tsx` DashboardScreen renders `<SubcontractorDashboard/>` when `roleInfo.roleName` lowercases to 'subcontractor', else owner dashboard. The badge change needs NO mobile rebuild — only the onboarding-persistence edit is mobile-side.
- `/api/subcontractor/dashboard` already returns clean empty data (no jobs/earnings/businesses) for an account with zero memberships, so a standalone sub gets a working empty dashboard, not a crash/403.
- `accountType` flows through the business-settings write routes because `businessSettingsWriteSchema` only omits billing/stripe/seat/trial/onboarding cols; it's not a privilege vector (only label/dashboard).
- Web `SimpleOnboarding` only supports subcontractors via invite-code redemption (no standalone path), so no web onboarding persistence was added; the backend label change covers any client.

**Deploy prerequisite:** prod needs the column before/with deploy or business-settings queries break on schema drift: `ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'business';`. Do NOT db:push (destructive on this DB — see db-add-table-no-push). Existing accounts (incl. the prod test account) default to 'business', so they must re-onboard as subcontractor to get the label.

**Personal-profile re-lock trap (the no-active-business fallback):** when a subcontractor switches to their Personal profile, `users.active_business_id` is null. BOTH `getUserContext()` (permissions.ts) and `/api/team/my-role` (routes.ts) have a "no active business" else-branch that, when the user has no real own business name (`hasRealOwnBusiness` false — placeholder/empty businessName), falls back to their JOINED membership via `getTeamMembershipByMemberId`. For a subcontractor that re-binds Personal profile to the joined locked role → mobile FloatingActionButton's `isStandaloneSubcontractor` resolves false → Quick Create tiles (job/quote/invoice/client) show padlocks AND the header still shows the joined business name. Fix: gate that fallback with `&& ownSettings?.accountType !== 'subcontractor'` in BOTH files (UI lock reads my-role; server route auth reads getUserContext — must match or create would 403 even with UI unlocked). A subcontractor with no own business + null active_business_id then falls through to owner-mode (isOwner true, full perms, roleName 'Subcontractor'). Plain workers (accountType 'business'/null) still inherit the invited business. Joined mode is unaffected (active_business_id set → the `if(activeBusinessId)` branch resolves the locked membership directly).
