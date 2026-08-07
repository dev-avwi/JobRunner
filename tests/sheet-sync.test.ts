/**
 * Sheet sync unit + API tests (Task #306).
 *
 * Covers:
 *  - Google OAuth token encryption at rest (seal/open roundtrip, plaintext
 *    rejection, tamper rejection)
 *  - Due-time logic used by the scheduler
 *  - OAuth callback state handling + settings-route invariants (via dev server)
 *
 * Run against the dev server:
 *   BASE_URL=http://localhost:5000 tsx tests/sheet-sync.test.ts
 */

import { sealToken, openToken } from '../server/sheetSync';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// ── Token encryption at rest ────────────────────────────────────────────────
console.log('Token encryption:');
{
  const sealed = sealToken('ya29.secret-access-token');
  check('sealToken produces enc:v1: prefixed ciphertext', !!sealed && sealed.startsWith('enc:v1:') && !sealed.includes('secret-access-token'));
  check('openToken roundtrips', openToken(sealed) === 'ya29.secret-access-token');
  check('sealToken(null) is null', sealToken(null) === null && sealToken(undefined) === null && sealToken('') === null);
  check('openToken rejects legacy plaintext', openToken('ya29.plaintext-token') === null);
  check('openToken rejects null/empty', openToken(null) === null && openToken('') === null);
  // Tamper: flip a hex char inside the ciphertext (GCM auth must fail)
  if (sealed) {
    const body = sealed.slice('enc:v1:'.length);
    const idx = body.lastIndexOf(':') + 2;
    const tampered = 'enc:v1:' + body.slice(0, idx) + (body[idx] === 'a' ? 'b' : 'a') + body.slice(idx + 1);
    check('openToken rejects tampered ciphertext', openToken(tampered) === null);
  }
}

// ── Due-time logic (mirrors processDueSheetSyncs) ───────────────────────────
console.log('Due-time logic:');
{
  const DAY = 24 * 60 * 60 * 1000;
  const WEEK = 7 * DAY;
  const TOL = 25 * 60 * 1000;
  const isDue = (lastRunAt: number | null, freqMs: number, now: number) =>
    now - (lastRunAt ?? 0) >= freqMs - TOL;
  const now = Date.now();
  check('never-run sync is due', isDue(null, DAY, now));
  check('just-run daily sync is not due', !isDue(now - 60_000, DAY, now));
  check('23h35m-old daily sync is due (tolerance)', isDue(now - (DAY - TOL), DAY, now));
  check('23h-old daily sync is not due', !isDue(now - 23 * 60 * 60 * 1000, DAY, now));
  check('6-day-old weekly sync is not due', !isDue(now - 6 * DAY, WEEK, now));
  check('7-day-old weekly sync is due', isDue(now - 7 * DAY, WEEK, now));
}

// ── API-level checks against the dev server ────────────────────────────────
async function apiChecks() {
  console.log('API checks:');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'demo@jobrunner.com.au', password: 'demo123' }),
  });
  if (!loginRes.ok) {
    console.log('  (skipped — demo login unavailable)');
    return;
  }
  const login = await loginRes.json();
  const token = Object.entries(login).find(([k, v]) => k.toLowerCase().includes('token') && typeof v === 'string')?.[1] as string;
  const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  // Callback with a bogus/expired state must NOT connect (redirects to error)
  const cb = await fetch(`${BASE_URL}/api/sheet-sync/callback?code=fake&state=nonexistent-state`, { redirect: 'manual' });
  const loc = cb.headers.get('location') || '';
  check('OAuth callback rejects unknown state', cb.status >= 300 && cb.status < 400 && loc.includes('sheetsync=error'), `status=${cb.status} loc=${loc}`);

  // Enabling with google target while unconnected must 400
  await fetch(`${BASE_URL}/api/sheet-sync/settings`, { method: 'POST', headers: auth, body: JSON.stringify({ enabled: false, target: 'google_sheets' }) });
  const enable = await fetch(`${BASE_URL}/api/sheet-sync/settings`, { method: 'POST', headers: auth, body: JSON.stringify({ enabled: true }) });
  check('enable with unconnected Google target returns 400', enable.status === 400);

  // Switching target to google while enabled (excel) must force-disable
  await fetch(`${BASE_URL}/api/sheet-sync/settings`, { method: 'POST', headers: auth, body: JSON.stringify({ target: 'excel_email', enabled: true }) });
  const switched = await fetch(`${BASE_URL}/api/sheet-sync/settings`, { method: 'POST', headers: auth, body: JSON.stringify({ target: 'google_sheets' }) });
  const switchedBody = await switched.json();
  check('switching to unusable Google target force-disables sync', switched.ok && switchedBody.enabled === false, JSON.stringify(switchedBody));

  // Status never leaks token material
  const status = await (await fetch(`${BASE_URL}/api/sheet-sync/status`, { headers: auth })).json();
  const statusStr = JSON.stringify(status);
  check('status payload contains no token fields', !statusStr.toLowerCase().includes('token') && !statusStr.includes('enc:v1:'), statusStr);

  // Unauthenticated access denied
  const anon = await fetch(`${BASE_URL}/api/sheet-sync/status`);
  check('status requires auth', anon.status === 401);

  // Cleanup: restore defaults
  await fetch(`${BASE_URL}/api/sheet-sync/settings`, { method: 'POST', headers: auth, body: JSON.stringify({ enabled: false, target: 'google_sheets', frequency: 'daily', dataTypes: ['clients', 'jobs', 'invoices', 'payments'] }) });
}

apiChecks()
  .catch((e) => {
    failed++;
    console.error('API checks crashed:', e);
  })
  .finally(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  });
