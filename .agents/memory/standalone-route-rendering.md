---
name: Standalone full-screen routes vs app shell
description: How AppLayout decides whether a route renders full-screen or inside the authenticated sidebar+header shell.
---

# Full-screen routes must be short-circuited for BOTH auth states

`client/src/App.tsx` AppLayout gates render in order: signing-out → loading →
logged-out branch (renders public/standalone pages like AcceptInvite) → platform
admin shell → workspace-loading → subscription-inactive → owner onboarding →
**main authenticated app shell** (SidebarProvider + Header + inner `<Router>` Switch).

A page that should be full-screen (no sidebar/header) for a LOGGED-IN user must be
returned by its OWN short-circuit BEFORE the main app shell. Adding it only to the
logged-out branch (or only as a `<Route>` inside the inner Switch) makes it render
embedded inside the dashboard shell once the user is authenticated.

**Why:** team invite / job-assignment acceptance (`/accept-invite/:token`,
`/accept-assignment/:jobId/:assignmentId`) previously only rendered standalone in the
logged-out branch. A signed-in owner clicking a "join the team" link saw the invite
card stuffed inside their own dashboard (sidebar+header), and the post-accept redirect
looked like nothing happened. Fix: a standalone short-circuit keyed on
`isInviteAcceptanceRoute`, placed after the onboarding gate and before the app shell.

**How to apply:** for any new full-screen flow reachable while authenticated, add an
explicit `if (location.startsWith(...)) return <Page/>` short-circuit before the shell;
the inner-Switch `<Route>` for it then becomes a defensive-only fallback. Components
that use `useRoute` internally don't need a `<Route>` wrapper to get params.

## Post-accept transition uses a hard reload
After accepting an invite, AcceptInvite navigates with `window.location.assign('/')`
(not wouter `setLocation`) so every gate (auth/me, business settings, active workspace)
re-resolves from the server. SPA navigation left stale cache → janky "nothing changed"
feel. Hard reload is acceptable for a terminal one-time transactional page.
