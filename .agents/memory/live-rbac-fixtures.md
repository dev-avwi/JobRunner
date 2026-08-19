---
name: Live RBAC fixtures
description: How to obtain reliable authenticated authorization evidence when seeded staff have no assigned work.
---

Seeded worker and subcontractor accounts can authenticate correctly while having no assigned jobs. Do not interpret an empty job list as proof that role restrictions work.

**Why:** Live role testing required multiple attempts because authentication state was valid but seed assignment state was not suitable for allow-and-deny comparisons.

**How to apply:** Create isolated jobs, documents, and assignments under the test owner, exercise assigned and unassigned requests with each live session, and remove every fixture afterward. Keep role permission differences explicit when interpreting expected denials.