#!/usr/bin/env node
// RBAC regression guard. Greps for ad-hoc role checks in newly added code that
// gate UI without going through the shared `can(action, record?)` helper. Run:
//   node scripts/rbac-audit.mjs
// Exits non-zero if any flagged patterns are found in disallowed locations.

import { spawnSync } from "node:child_process";

// Files allowed to use raw role checks (foundation helpers, route guards,
// dashboards that choose layout by role, etc.). Everything else should go
// through `useCan()` / `can(action, record?)`.
const ALLOWLIST = [
  "client/src/lib/can.ts",
  "client/src/lib/permissions.ts",
  "client/src/lib/permission-map.ts",
  "client/src/lib/navigation-config.ts",
  "client/src/hooks/use-user-role.ts",
  "client/src/hooks/use-app-mode.ts",
  "client/src/components/ProtectedRoute.tsx",
  "client/src/components/RouteGuard.tsx",
  "client/src/components/AppSidebar.tsx",
  "client/src/components/BottomNav.tsx",
  "client/src/components/AdminAppShell.tsx",
  "client/src/components/Dashboard.tsx",
  "client/src/components/OwnerManagerDashboard.tsx",
  "client/src/components/TeamOwnerDashboard.tsx",
  "mobile/src/lib/can.ts",
  "mobile/src/hooks/use-user-role.ts",
  "mobile/src/hooks/useWorkerPermission.ts",
  "mobile/src/lib/store.ts",
  "client/src/pages/JobInvite.tsx",
];

// Patterns that indicate a UI gating decision based on a raw role string
// instead of going through the can()/actionPermissions API.
const PATTERN = String.raw`role\s*===\s*['"](owner|manager|office_admin|tradie|staff_tradie|staff|subcontractor)['"]`;

const result = spawnSync(
  "rg",
  ["--no-heading", "--line-number", "--color", "never", "-e", PATTERN, "client/src", "mobile/src"],
  { encoding: "utf8" }
);
if (result.error) {
  console.error("Failed to invoke ripgrep:", result.error.message);
  process.exit(2);
}
// rg exits 1 when there are no matches — that's fine.
const out = result.stdout || "";

const offenders = [];
for (const line of out.split("\n")) {
  if (!line.trim()) continue;
  const [file] = line.split(":");
  if (ALLOWLIST.some((p) => file === p || file.endsWith("/" + p))) continue;
  offenders.push(line);
}

if (offenders.length === 0) {
  console.log("RBAC audit OK: no ad-hoc role string gating outside the allowlist.");
  process.exit(0);
}

console.error("RBAC audit FAILED: replace these raw role checks with can(action, record?):\n");
for (const line of offenders) console.error("  " + line);
console.error(
  `\n${offenders.length} offending line(s). Allowed locations are listed in scripts/rbac-audit.mjs.`
);
process.exit(1);
