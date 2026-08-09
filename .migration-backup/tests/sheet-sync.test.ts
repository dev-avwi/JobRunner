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

import { sealToken, openToken, buildExportSheets, isGoogleAuthError, SHEET_SYNC_DATA_TYPES } from '../server/sheetSync';
import { storage } from '../server/storage';

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
  check('weekly boundary: due exactly at tolerance edge', isDue(now - (WEEK - TOL), WEEK, now));
  check('weekly boundary: 1ms inside tolerance edge is not due', !isDue(now - (WEEK - TOL - 1), WEEK, now));
}

// ── Auth health check (Task #338, storage stubbed) ─────────────────────────
async function authHealthChecks() {
  console.log('Auth health check:');
  const { checkSheetSyncAuthHealth } = await import('../server/sheetSync');

  const origGetSettings = storage.getBusinessSettings;
  const origUpdateSettings = storage.updateBusinessSettings;
  const origCreateNotification = storage.createNotification;

  let updates: any[] = [];
  let notifications: any[] = [];
  (storage as any).updateBusinessSettings = async (_id: string, u: any) => { updates.push(u); return u; };
  (storage as any).createNotification = async (n: any) => { notifications.push(n); return n; };
  const reset = () => { updates = []; notifications = []; };

  try {
    // Disabled sync → no-op
    reset();
    (storage as any).getBusinessSettings = async () => ({ sheetSyncEnabled: false });
    await checkSheetSyncAuthHealth('u1');
    check('disabled sync is a no-op', updates.length === 0 && notifications.length === 0);

    // Excel email target → no-op
    reset();
    (storage as any).getBusinessSettings = async () => ({ sheetSyncEnabled: true, sheetSyncTarget: 'excel_email', googleSheetsConnected: true });
    await checkSheetSyncAuthHealth('u1');
    check('excel_email target is a no-op', updates.length === 0 && notifications.length === 0);

    // Already flagged auth error → no re-notify
    reset();
    (storage as any).getBusinessSettings = async () => ({
      sheetSyncEnabled: true, sheetSyncTarget: 'google_sheets', googleSheetsConnected: true,
      sheetSyncLastStatus: 'error', sheetSyncLastError: 'Google Sheets access was revoked. Please reconnect in Settings.',
    });
    await checkSheetSyncAuthHealth('u1');
    check('already-flagged auth error is not re-notified', updates.length === 0 && notifications.length === 0);

    // Disconnected → no-op (banner already shows via googleConnected=false)
    reset();
    (storage as any).getBusinessSettings = async () => ({ sheetSyncEnabled: true, googleSheetsConnected: false });
    await checkSheetSyncAuthHealth('u1');
    check('disconnected Google is not re-notified', updates.length === 0 && notifications.length === 0);

    // Unusable refresh token (legacy plaintext) → auth error path: flags
    // sheetSyncLastStatus=error with an auth-recognisable message + notifies.
    reset();
    (storage as any).getBusinessSettings = async () => ({
      sheetSyncEnabled: true, sheetSyncTarget: 'google_sheets', googleSheetsConnected: true,
      googleSheetsRefreshToken: 'plaintext-legacy-token', sheetSyncLastStatus: 'success',
    });
    await checkSheetSyncAuthHealth('u1');
    const errorUpdate = updates.find((u) => u.sheetSyncLastStatus === 'error');
    check('broken auth flags sheetSyncLastStatus=error', !!errorUpdate);
    check('flagged error is auth-recognisable (needsReconnect fires)', !!errorUpdate && isGoogleAuthError(errorUpdate.sheetSyncLastError));
    check('broken auth creates a bell notification', notifications.length === 1 && notifications[0].type === 'sheet_sync_failed');
    check('health check never touches sheetSyncLastRunAt', updates.every((u) => !('sheetSyncLastRunAt' in u)));
  } finally {
    (storage as any).getBusinessSettings = origGetSettings;
    (storage as any).updateBusinessSettings = origUpdateSettings;
    (storage as any).createNotification = origCreateNotification;
  }
}

// ── buildExportSheets output shapes (storage stubbed — pure unit tests) ─────
async function exportShapeChecks() {
  console.log('Export sheet shapes:');

  const origGetClients = storage.getClients;
  const origGetJobs = storage.getJobs;
  const origGetInvoices = storage.getInvoices;
  const origGetReceipts = storage.getReceipts;

  const client = {
    id: 'c1', name: 'Acme Plumbing', email: 'acme@example.com', phone: '0400 000 000',
    address: '1 Test St', notes: 'VIP', createdAt: '2026-01-05T00:00:00.000Z',
  };
  (storage as any).getClients = async () => [client];
  (storage as any).getJobs = async () => [{
    id: 'j1', title: 'Fix tap', clientId: 'c1', status: 'done', address: '1 Test St',
    scheduledAt: '2026-02-10T00:00:00.000Z', description: 'Leaky tap', createdAt: '2026-02-01T00:00:00.000Z',
  }];
  (storage as any).getInvoices = async () => [{
    id: 'i1', number: 'INV-0001', clientId: 'c1', title: 'Tap repair', status: 'paid',
    subtotal: '100', gstAmount: '10', total: 110.5,
    dueDate: '2026-03-01T00:00:00.000Z', paidAt: '2026-02-20T00:00:00.000Z', createdAt: '2026-02-15T00:00:00.000Z',
  }];
  (storage as any).getReceipts = async () => [{
    id: 'r1', receiptNumber: 'RCPT-0001', clientId: 'other-client', amount: 'not-a-number', gstAmount: null,
    paymentMethod: 'card', paymentReference: 'ref-1', description: 'Payment', paidAt: 'garbage-date',
  }];

  try {
    const sheets = await buildExportSheets('u1', [...SHEET_SYNC_DATA_TYPES]);
    check('all four data types produce a sheet each', sheets.length === 4);
    check('sheet titles + order are stable', JSON.stringify(sheets.map((s) => s.title)) === JSON.stringify(['Clients', 'Jobs', 'Invoices', 'Payments']));

    const byTitle = new Map(sheets.map((s) => [s.title, s]));

    const clients = byTitle.get('Clients')!;
    check('Clients headers', JSON.stringify(clients.headers) === JSON.stringify(['Name', 'Email', 'Phone', 'Address', 'Notes', 'Created Date']), JSON.stringify(clients.headers));
    check('Clients row matches header width', clients.rows.length === 1 && clients.rows[0].length === clients.headers.length);
    check('Clients row values + AU date format', JSON.stringify(clients.rows[0]) === JSON.stringify(['Acme Plumbing', 'acme@example.com', '0400 000 000', '1 Test St', 'VIP', '05/01/2026']), JSON.stringify(clients.rows[0]));

    const jobs = byTitle.get('Jobs')!;
    check('Jobs headers', JSON.stringify(jobs.headers) === JSON.stringify(['Title', 'Client Name', 'Status', 'Address', 'Scheduled Date', 'Description', 'Created Date']), JSON.stringify(jobs.headers));
    check('Jobs row matches header width', jobs.rows.length === 1 && jobs.rows[0].length === jobs.headers.length);
    check('Jobs client id resolves to client name', jobs.rows[0][1] === 'Acme Plumbing');

    const invoices = byTitle.get('Invoices')!;
    check('Invoices headers', JSON.stringify(invoices.headers) === JSON.stringify(['Invoice Number', 'Client Name', 'Title', 'Status', 'Subtotal', 'GST', 'Total', 'Due Date', 'Paid Date', 'Created Date']), JSON.stringify(invoices.headers));
    check('Invoices row matches header width', invoices.rows.length === 1 && invoices.rows[0].length === invoices.headers.length);
    check('Invoice money fields are 2dp strings', invoices.rows[0][4] === '100.00' && invoices.rows[0][5] === '10.00' && invoices.rows[0][6] === '110.50', JSON.stringify(invoices.rows[0]));

    const payments = byTitle.get('Payments')!;
    check('Payments headers', JSON.stringify(payments.headers) === JSON.stringify(['Receipt Number', 'Client Name', 'Amount', 'GST', 'Payment Method', 'Reference', 'Description', 'Paid Date']), JSON.stringify(payments.headers));
    check('Payments row matches header width', payments.rows.length === 1 && payments.rows[0].length === payments.headers.length);
    check('Unknown client id yields empty client name', payments.rows[0][1] === '');
    check('Bad amount/GST fall back to 0.00', payments.rows[0][2] === '0.00' && payments.rows[0][3] === '0.00');
    check('Invalid date renders empty string', payments.rows[0][7] === '');

    const subset = await buildExportSheets('u1', ['jobs', 'clients']);
    check('subset request keeps canonical order and drops others', JSON.stringify(subset.map((s) => s.title)) === JSON.stringify(['Clients', 'Jobs']));
    const bogus = await buildExportSheets('u1', ['quotes', 'nonsense']);
    check('unknown data types are ignored', bogus.length === 0);
  } finally {
    (storage as any).getClients = origGetClients;
    (storage as any).getJobs = origGetJobs;
    (storage as any).getInvoices = origGetInvoices;
    (storage as any).getReceipts = origGetReceipts;
  }
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

authHealthChecks()
  .catch((e) => {
    failed++;
    console.error('Auth health checks crashed:', e);
  })
  .then(() => exportShapeChecks())
  .catch((e) => {
    failed++;
    console.error('Export shape checks crashed:', e);
  })
  .then(() => apiChecks())
  .catch((e) => {
    failed++;
    console.error('API checks crashed:', e);
  })
  .finally(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  });
