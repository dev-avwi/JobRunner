/**
 * RBAC endpoint allow/deny check (Task #213).
 *
 * Proves that the role permission gates added to owner-only / manager-only
 * actions actually deny a low-privilege team member (worker) at runtime while
 * still allowing the business owner through.
 *
 * How it works:
 *   1. Logs in as the demo OWNER and the demo WORKER (both seeded by
 *      server/demoData.ts). /api/auth/login returns `sessionToken` which the
 *      requireAuth middleware accepts as `Authorization: Bearer <token>`.
 *   2. For each gated endpoint it sends the SAME request as the worker and as
 *      the owner.
 *   3. Worker MUST get 403 (permission gate denies). Owner MUST NOT get 403
 *      (gate lets them through to the handler).
 *
 * Owner requests deliberately use bogus ids / empty bodies so the underlying
 * handler short-circuits to 400/404 AFTER the gate passes — no real data is
 * created, mutated, or deleted. We only assert on the status code class
 * (403 = denied vs not), never on side effects.
 *
 * Usage:
 *   BASE_URL=http://localhost:5000 node scripts/rbac-endpoint-check.mjs
 *
 * Exit code 0 = all gates behave correctly, 1 = at least one gate is wrong.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

const OWNER = {
  email: process.env.RBAC_OWNER_EMAIL || 'demo@jobrunner.com.au',
  password: process.env.RBAC_OWNER_PASSWORD || 'demo123',
};
const WORKER = {
  email: process.env.RBAC_WORKER_EMAIL || 'worker@jobrunner.com.au',
  password: process.env.RBAC_WORKER_PASSWORD || 'worker123',
};

// A bogus id used for PATCH/DELETE/sub-resource routes so the owner request
// reaches the handler (past the gate) and 404s instead of touching real data.
const BOGUS = '00000000-0000-0000-0000-000000000000';

/**
 * Each entry is a gated endpoint. `body` (optional) is sent as JSON; left empty
 * or invalid on purpose so the owner request fails validation (400) AFTER the
 * gate, never mutating real data.
 */
const ENDPOINTS = [
  // Inventory catalog — MANAGE_CATALOG
  { gate: 'MANAGE_CATALOG', method: 'POST', path: '/api/inventory/categories', body: {} },
  { gate: 'MANAGE_CATALOG', method: 'PATCH', path: `/api/inventory/categories/${BOGUS}`, body: {} },
  { gate: 'MANAGE_CATALOG', method: 'DELETE', path: `/api/inventory/categories/${BOGUS}` },
  { gate: 'MANAGE_CATALOG', method: 'POST', path: '/api/inventory/items', body: {} },
  { gate: 'MANAGE_CATALOG', method: 'PATCH', path: `/api/inventory/items/${BOGUS}`, body: {} },
  { gate: 'MANAGE_CATALOG', method: 'DELETE', path: `/api/inventory/items/${BOGUS}` },

  // Equipment register — MANAGE_CATALOG
  { gate: 'MANAGE_CATALOG', method: 'POST', path: '/api/equipment/categories', body: {} },
  { gate: 'MANAGE_CATALOG', method: 'POST', path: '/api/equipment', body: {} },
  { gate: 'MANAGE_CATALOG', method: 'PATCH', path: `/api/equipment/${BOGUS}`, body: {} },
  { gate: 'MANAGE_CATALOG', method: 'DELETE', path: `/api/equipment/${BOGUS}` },

  // Rebates (money out) — WRITE_EXPENSES
  { gate: 'WRITE_EXPENSES', method: 'POST', path: '/api/rebates', body: {} },
  { gate: 'WRITE_EXPENSES', method: 'PATCH', path: `/api/rebates/${BOGUS}`, body: {} },
  { gate: 'WRITE_EXPENSES', method: 'DELETE', path: `/api/rebates/${BOGUS}` },
  { gate: 'WRITE_EXPENSES', method: 'POST', path: `/api/rebates/${BOGUS}/submit`, body: {} },
  { gate: 'WRITE_EXPENSES', method: 'POST', path: `/api/rebates/${BOGUS}/receive`, body: {} },

  // Jobs lifecycle — WRITE_JOBS (match existing clone/photo-update siblings)
  { gate: 'WRITE_JOBS', method: 'POST', path: `/api/jobs/${BOGUS}/archive`, body: {} },
  { gate: 'WRITE_JOBS', method: 'POST', path: `/api/jobs/${BOGUS}/unarchive`, body: {} },
  { gate: 'WRITE_JOBS', method: 'DELETE', path: `/api/jobs/${BOGUS}/photos/${BOGUS}` },

  // Integration configuration — ownerOnly()
  { gate: 'ownerOnly', method: 'POST', path: '/api/integrations/save-stripe-keys', body: {} },
  { gate: 'ownerOnly', method: 'POST', path: '/api/integrations/save-sendgrid-key', body: {} },
  { gate: 'ownerOnly', method: 'POST', path: '/api/integrations/xero/mobile-connect', body: {} },
  { gate: 'ownerOnly', method: 'POST', path: '/api/integrations/xero/connect', body: {} },
  { gate: 'ownerOnly', method: 'POST', path: '/api/integrations/xero/disconnect', body: {} },
  { gate: 'ownerOnly', method: 'POST', path: '/api/integrations/xero/switch-tenant', body: {} },
  { gate: 'ownerOnly', method: 'POST', path: '/api/integrations/myob/mobile-connect', body: {} },
  { gate: 'ownerOnly', method: 'POST', path: '/api/integrations/myob/connect', body: {} },
  { gate: 'ownerOnly', method: 'POST', path: '/api/integrations/myob/disconnect', body: {} },
  { gate: 'ownerOnly', method: 'POST', path: '/api/integrations/myob/credentials', body: {} },
  { gate: 'ownerOnly', method: 'POST', path: '/api/integrations/quickbooks/mobile-connect', body: {} },
  { gate: 'ownerOnly', method: 'POST', path: '/api/integrations/quickbooks/connect', body: {} },
  { gate: 'ownerOnly', method: 'POST', path: '/api/integrations/quickbooks/disconnect', body: {} },
  { gate: 'ownerOnly', method: 'POST', path: '/api/integrations/google-calendar/connect', body: {} },
  { gate: 'ownerOnly', method: 'POST', path: '/api/integrations/google-calendar/disconnect', body: {} },
  { gate: 'ownerOnly', method: 'POST', path: '/api/integrations/outlook/connect', body: {} },
  { gate: 'ownerOnly', method: 'POST', path: '/api/integrations/outlook/disconnect', body: {} },
];

async function login(creds) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(creds),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.sessionToken) {
    throw new Error(
      `Login failed for ${creds.email} (${res.status}): ${body?.error || 'no sessionToken'}`,
    );
  }
  return body.sessionToken;
}

async function call(token, ep) {
  const headers = { authorization: `Bearer ${token}` };
  let body;
  if (ep.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(ep.body);
  }
  const res = await fetch(`${BASE_URL}${ep.path}`, { method: ep.method, headers, body });
  return res.status;
}

async function main() {
  console.log(`RBAC endpoint check against ${BASE_URL}`);
  const [ownerToken, workerToken] = await Promise.all([login(OWNER), login(WORKER)]);
  console.log(`Logged in owner=${OWNER.email} worker=${WORKER.email}\n`);

  let failures = 0;
  for (const ep of ENDPOINTS) {
    const [workerStatus, ownerStatus] = await Promise.all([
      call(workerToken, ep),
      call(ownerToken, ep),
    ]);

    // Worker must be denied (403). Owner must NOT be denied (anything but 403;
    // 400/404 from the handler is fine and proves the gate let them through).
    const workerDenied = workerStatus === 403;
    const ownerAllowed = ownerStatus !== 403 && ownerStatus !== 401;
    const ok = workerDenied && ownerAllowed;
    if (!ok) failures++;

    const tag = ok ? 'PASS' : 'FAIL';
    console.log(
      `[${tag}] ${ep.gate.padEnd(15)} ${ep.method.padEnd(6)} ${ep.path}\n` +
        `        worker=${workerStatus} (want 403) owner=${ownerStatus} (want not 403/401)`,
    );
  }

  console.log(
    `\n${ENDPOINTS.length - failures}/${ENDPOINTS.length} endpoints behave correctly.`,
  );
  if (failures > 0) {
    console.error(`${failures} endpoint(s) failed the RBAC check.`);
    process.exit(1);
  }
  console.log('All RBAC gates verified: worker denied, owner allowed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
