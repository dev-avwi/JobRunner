---
name: Settings tab role scoping
description: Which Settings tabs are safe to expose to worker (staff_tradie) accounts and which are owner-only.
---

# Settings.tsx tab scoping for workers

Worker (staff_tradie) accounts should only get **My Account**, **Appearance**, and **Support** tabs.

- **Appearance** tab holds the personal "Your Colour" map-colour picker (`/api/team/colors/available`, `/api/user/theme-color` — both `requireAuth`, work for all roles) plus the brand "App Color" picker which MUST stay wrapped in `{canAccessBusinessSettings && (...)}` (`canAccessBusinessSettings = !isTradie`).
- The **Notifications** tab is NOT worker-safe even though it looks like "personal notification prefs." Its toggles ("Quote Responses / Payment Confirmations / Overdue Invoices / Weekly Summary") save via `POST /api/integrations/settings`, which is `ownerOnly()`. Exposing it to workers lets them open the tab but every toggle 403s. Keep it gated behind `canAccessBusinessSettings`.
- **Why:** there is no user-scoped personal-notification endpoint here; the notification surface is business-owner email settings. Workers' real settings need is just their colour + own profile.
- **How to apply:** three gates must agree — the `savedTab` localStorage allowlist, the `isAlwaysAvailable` set used by deep-link switching, and the `TabsTrigger` render gate. If you add a tab for workers, update all three; if it writes to an owner-only endpoint, don't.
- AI Features card lives in the **Business** tab (owner-only), not Notifications — it uses owner-only `businessData`/`handleBusinessSave`.
