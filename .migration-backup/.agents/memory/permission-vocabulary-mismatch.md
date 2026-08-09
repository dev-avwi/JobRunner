---
name: Permission vocabulary mismatch (granular vs coarse)
description: Why some team roles get a correct-looking 403 on writes — two permission vocabularies that never bridged, and where the bridge lives.
---

# Dual permission vocabularies

JobRunner stores role permissions (`user_roles.permissions`) in **two** historical
vocabularies that do NOT match each other:

- **Granular** (`view_clients`, `create_clients`, `update_clients`, `edit_clients`,
  `view_jobs`, `create_jobs`, `update_jobs`, `send_invoices`, `collect_payments`,
  `track_time`, `edit_documents`…). Used by: the mobile UI gating
  (`mobile/src/hooks/use-user-role.ts` `PERMISSION_KEYS`), `shared/schema.ts`
  `WORKER_PERMISSIONS` / role presets, and many real prod roles
  (e.g. "Office Manager", "Apprentice").
- **Coarse** (`read_jobs`, `write_jobs`, `read_clients`, `write_clients`,
  `read_quotes`, `write_quotes`, `manage_payments`, `read_clients_sensitive`…).
  Defined in `server/permissions.ts` `PERMISSIONS` and checked by ALL route
  middleware (`createPermissionMiddleware` / `requirePermission`). Some prod roles
  ("Manager", "Worker", "Technician") happen to store coarse strings.

**Symptom:** a worker the owner explicitly granted client/job/quote/invoice write
rights gets `403 Access denied requiredPermission ["write_clients"]` (or write_jobs,
etc.). The mobile UI shows the button (role has `create_clients`) but the route
requires `write_clients`, which a granular role never has.

**Fix (the bridge):** `expandPermissions()` + `PERMISSION_ALIASES` in
`server/permissions.ts`, applied inside `getUserContext` to BOTH the
`role.permissions` and `customPermissions` paths. It is **additive** — keeps the
original strings (so the mobile UI, which reads raw granular strings from
`/api/team/my-role`, and coarse roles and wildcard `*` are all untouched) and only
adds the coarse equivalent each granular verb implies.

**Why additive at getUserContext (not per-route, not a data migration):** one place
covers every check that reads `userContext.permissions` (middleware + direct
`.includes()` calls); no risk to the 57 real prod users' role rows; coarse roles
unaffected.

**Gotchas when extending the alias map:**
- `view_clients` MUST map to `read_clients_sensitive` too (not just `read_clients`)
  — schema documents it as "full client details (address/phone/email)" and the
  granular vocab has no separate sensitive-view perm; otherwise PII gets redacted
  for granular roles (`sanitizeClientData`, helpers.ts, jobs.ts gate on
  READ_CLIENTS_SENSITIVE).
- `edit_documents` spans both `write_quotes` + `write_invoices`.
- `send_quotes`/`send_invoices` map to `write_quotes`/`write_invoices` because the
  send routes are guarded by WRITE_* (coarse system has no finer "send" gate).
- To find what coarse perms routes actually enforce:
  `rg -o 'createPermissionMiddleware\(PERMISSIONS\.[A-Z_]+\)' server/routes.ts | sort | uniq -c`.

**Longer-term (not done):** converge on one canonical vocabulary to stop the drift.
