---
name: GuidedTour advance mechanism
description: How the in-app GuidedTour advances steps and why it must stay route-driven (not click-driven).
---

# GuidedTour step advancement

`client/src/components/GuidedTour.tsx` drives an overlay tour using wouter `location`.

**Rule: route change is the SINGLE source of truth for advancing interactive (forced-click) steps. Do NOT add a click listener that also advances.**

**Why:** Originally BOTH a DOM click listener AND a route-change effect advanced the
tour. Every interactive target in this tour navigates (sidebar items, bottom-nav,
"More" menu, and the `+ New X` create buttons all change the URL), so both fired for
one navigation and the tour skipped a step — most visibly jumping Settings straight to
Finish. The route effect alone is idempotent (after advancing, the new step's expected
next route differs from the current `location`, so it won't re-fire).

**How to apply:**
- Interactive steps advance only via the route effect, comparing the *resolved* path
  (`desktopRoute ?? route`, with the `?query` stripped) of the next step against
  `location`. The "Done" button is the manual fallback if a target can't be clicked.
- Free-interaction form steps (`allowInteraction: true`, used for `/clients/new`,
  `/jobs/new`, `/quotes/new`) keep the page fully usable: overlay `pointerEvents:none`,
  no dim/cutout, Next+Skip always shown. They auto-advance on `advanceOnRoute` ONLY
  after first landing on their own route (a `freeFormReadyRef` gate) so a stale
  `location` from the previous step can't skip the form on entry.
- Creation flows are full-page routes, not modals. `/quotes` redirects to
  `/documents?tab=quotes`; the quote create button lives on that quotes tab.
- Do not reintroduce a global time-based advance lock — it drops legitimate
  back-to-back advances (e.g. mobile More → Clients).
