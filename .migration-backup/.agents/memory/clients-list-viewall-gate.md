---
name: Clients list VIEW_ALL gate excluded office roles
description: Why GET /api/clients returned an empty list for office staff (Office Manager etc.) and the signal that distinguishes office roles from field tradies.
---

# /api/clients full-list visibility gate

GET `/api/clients` narrows results to "clients on jobs assigned to me" for any
team member who is NOT the owner and lacks `view_all`. That gate was too narrow:
an office role (e.g. "Office Manager") granted the `view_clients` capability has
NO assigned jobs, so the list came back **empty** even though the role is meant
to browse the whole client book.

**Fix / rule:** the full-client-book gate must also pass for
`read_clients_sensitive` (and wildcard `*`). `view_clients` expands (additively,
via `expandPermissions`) to `read_clients` + `read_clients_sensitive`, so
`read_clients_sensitive` is the clean signal that separates office/admin roles
(see all clients) from **field tradies** who hold only bare `read_clients`
(Technician/Worker/Manager) and should stay narrowed to their assigned-job
clients.

**Why:** keying full visibility on `view_all` alone silently locked out office
staff who were explicitly given client-view permission. This is the same
VIEW_ALL-gate family as `job-list-endpoints-viewall-gate.md` /
`permission-vocabulary-mismatch.md` — when gating a "see everything in domain X"
list, accept the granular domain grant, not just the coarse `view_all`.

**How to apply:** any list endpoint that defaults non-owners to "only my
assigned records" must decide which roles get the full view by the domain's own
grant (here `read_clients_sensitive`), not exclusively `view_all`.
