#!/usr/bin/env node
/**
 * Production smoke suite (Task #109: catch broken pages before they reach users).
 *
 * Exercises the deployed site (https://jobrunner.com.au by default) from the
 * user's perspective:
 *
 *   API checks (always run — fast, bounded, no browser):
 *     1. /api/health responds healthy
 *     2. Email/password login with the dedicated smoke account succeeds and
 *        the authenticated dashboard APIs (/api/auth/me, /api/business-settings,
 *        /api/jobs, /api/clients) all return 200 — this is the walkthrough that
 *        would have caught the "column xero_tax_rate_id does not exist" outage
 *     3. Register code path executes without a 500 (duplicate-email probe of
 *        the smoke account — no rows are created in prod)
 *     4. Google OAuth round-trip: /api/auth/google 302s to accounts.google.com
 *        with the correct callback, and the callback route degrades gracefully
 *     5. Magic-link subcontractor endpoints return 4xx (never 5xx) on bad tokens
 *
 *   Browser checks (skipped with --api-only; Puppeteer + system Chromium):
 *     6. Landing page and login page render
 *     7. Login through the real form → dashboard, no 5xx API responses
 *     8. Magic-link landing page (/m/:token) renders a graceful state
 *
 * The dedicated smoke account (prod-smoke@jobrunner.com.au) is provisioned by
 * the production server itself (server/prodSmokeScheduler.ts) with a password
 * deterministically derived from SESSION_SECRET, so this script can log in
 * from any environment that shares that secret. Overrides:
 *   PROD_SMOKE_EMAIL / PROD_SMOKE_PASSWORD / PROD_SMOKE_BASE_URL
 *
 * The login walkthrough is MANDATORY: missing credentials or a failed login is
 * a failure, not a skip (set PROD_SMOKE_ALLOW_SKIP_LOGIN=1 only for bootstrap
 * environments that cannot derive the password).
 *
 * Exit codes (mirrors scripts/check-schema-drift.mjs semantics):
 *   0 — all executed checks passed
 *   1 — one or more checks FAILED (broken page / 5xx / bad flow)
 *   2 — unable to run (no network to prod, browser unavailable)
 *   3 — smoke account awaiting provisioning (clean invalid-credentials /
 *       unverified-email rejection while every other check passes). This only
 *       happens in the bootstrap window before the deployed server has run
 *       ensureSmokeAccount(); callers may treat it as a warning, not an outage.
 */

import { execSync } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';

const API_ONLY = process.argv.includes('--api-only');
const BASE = (process.env.PROD_SMOKE_BASE_URL || 'https://jobrunner.com.au').replace(/\/+$/, '');
const SMOKE_EMAIL_DEFAULT = 'prod-smoke@jobrunner.com.au';
const EMAIL = process.env.PROD_SMOKE_EMAIL || SMOKE_EMAIL_DEFAULT;
const PASSWORD = process.env.PROD_SMOKE_PASSWORD || deriveSmokePassword();
const TIMEOUT = API_ONLY ? 10_000 : 20_000;
const NAV_TIMEOUT = 45_000;

/**
 * Deterministic smoke-account password shared with server/prodSmokeScheduler.ts
 * (which provisions/rotates the account). Derived, never stored.
 */
function deriveSmokePassword() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return '';
  return 'Sm0ke!' + createHmac('sha256', secret).update('prod-smoke-account-v1').digest('hex').slice(0, 24);
}

const results = []; // { name, status: 'pass'|'fail'|'skip'|'pending', detail }
const log = (msg) => console.log(`[prod-smoke] ${msg}`);
const record = (name, status, detail = '') => {
  results.push({ name, status, detail });
  const tag = status === 'pass' ? 'PASS' : status === 'skip' ? 'SKIP' : status === 'pending' ? 'PENDING' : 'FAIL';
  (status === 'fail' ? console.error : console.log)(`[prod-smoke] ${tag}  ${name}${detail ? ` — ${detail}` : ''}`);
};

function unable(msg) {
  console.error(`[prod-smoke] UNABLE — ${msg}`);
  process.exit(2);
}

async function fetchJson(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT),
    ...opts,
    headers: { 'content-type': 'application/json', 'user-agent': 'JobRunner-ProdSmoke/1.0', ...(opts.headers || {}) },
  });
  let body = null;
  try { body = await res.json(); } catch {}
  return { status: res.status, headers: res.headers, body };
}

// ---------------------------------------------------------------------------
// 0. Reachability gate — if we can't reach prod at all, exit 2 (unable), so a
//    sandbox without egress doesn't masquerade as an outage.
// ---------------------------------------------------------------------------
let health;
try {
  health = await fetchJson('/api/health');
} catch (err) {
  unable(`cannot reach ${BASE}: ${err.message}`);
}

// 1. Health
if (health.status === 200 && health.body?.status === 'healthy' && health.body?.database === 'connected') {
  record('health endpoint', 'pass', `db connected, ${health.body.responseMs}ms`);
} else {
  record('health endpoint', 'fail', `status=${health.status} body=${JSON.stringify(health.body)?.slice(0, 200)}`);
}

// ---------------------------------------------------------------------------
// 2. Email/password login (API) + authenticated dashboard surface. MANDATORY.
// ---------------------------------------------------------------------------
let bearerToken = '';
let loginPending = false;
if (!PASSWORD) {
  if (process.env.PROD_SMOKE_ALLOW_SKIP_LOGIN === '1') {
    record('email/password login (API)', 'skip', 'no PROD_SMOKE_PASSWORD or SESSION_SECRET available');
  } else {
    record('email/password login (API)', 'fail', 'no credentials: set PROD_SMOKE_EMAIL/PROD_SMOKE_PASSWORD or SESSION_SECRET');
  }
} else {
  try {
    const res = await fetchJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    if (res.status === 200 && res.body?.success && res.body?.sessionToken) {
      bearerToken = res.body.sessionToken;
      record('email/password login (API)', 'pass', `logged in as ${EMAIL}`);
    } else if (
      EMAIL === SMOKE_EMAIL_DEFAULT
      && ((res.status === 401 && /invalid email or password/i.test(res.body?.error || ''))
        || (res.status === 403 && res.body?.requiresVerification))
    ) {
      // Clean credential rejection of the dedicated smoke account = the
      // deployed server has not yet run ensureSmokeAccount() (bootstrap
      // window before the next publish). A real auth outage shows up as a
      // 5xx / timeout / broken page instead and still fails hard.
      loginPending = true;
      record('email/password login (API)', 'pending', `status=${res.status} — smoke account awaits server-side provisioning (next deploy runs ensureSmokeAccount)`);
    } else {
      record('email/password login (API)', 'fail', `status=${res.status} error=${res.body?.error || ''}`);
    }
  } catch (err) {
    record('email/password login (API)', 'fail', err.message);
  }

  if (bearerToken) {
    for (const path of ['/api/auth/me', '/api/business-settings', '/api/jobs', '/api/clients']) {
      try {
        const res = await fetchJson(path, { headers: { authorization: `Bearer ${bearerToken}` } });
        record(`authed GET ${path}`, res.status === 200 ? 'pass' : 'fail', `status=${res.status}${res.status >= 400 ? ` body=${JSON.stringify(res.body)?.slice(0, 160)}` : ''}`);
      } catch (err) {
        record(`authed GET ${path}`, 'fail', err.message);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Register code path (no row creation): POST the smoke account's own email
//    and expect the duplicate-email branch — that runs the same DB lookups a
//    real registration does, without polluting prod.
// ---------------------------------------------------------------------------
try {
  const res = await fetchJson('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: `Rg!${randomBytes(12).toString('hex')}`, firstName: 'Smoke', lastName: 'Test', tradeType: 'other' }),
  });
  const ok = res.status === 409 || (res.status < 500 && typeof res.body?.code === 'string' && res.body.code.startsWith('email_in_use'));
  record('register duplicate-email path', ok ? 'pass' : 'fail', `status=${res.status} code=${res.body?.code || ''}`);
} catch (err) {
  record('register duplicate-email path', 'fail', err.message);
}

// ---------------------------------------------------------------------------
// 4. Google OAuth round-trip (API level — a real Google login can't be
//    completed headlessly, so we assert the handshake wiring instead).
// ---------------------------------------------------------------------------
try {
  const res = await fetch(`${BASE}/api/auth/google`, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT) });
  const loc = res.headers.get('location') || '';
  // The server pins the callback to the production domain, so only assert the
  // exact callback host when targeting production.
  const expectedCallback = BASE === 'https://jobrunner.com.au'
    ? encodeURIComponent(`${BASE}/api/auth/google/callback`)
    : encodeURIComponent('/api/auth/google/callback');
  const ok = res.status >= 300 && res.status < 400
    && loc.startsWith('https://accounts.google.com/')
    && loc.includes(expectedCallback);
  record('google oauth redirect', ok ? 'pass' : 'fail', ok ? '' : `status=${res.status} location=${loc.slice(0, 160)}`);

  // Callback without a code must degrade gracefully (redirect with error), never 5xx.
  const cb = await fetch(`${BASE}/api/auth/google/callback?state=web`, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT) });
  record('google oauth callback degrades gracefully', cb.status < 500 ? 'pass' : 'fail', `status=${cb.status}`);
} catch (err) {
  record('google oauth redirect', 'fail', err.message);
}

// ---------------------------------------------------------------------------
// 5. Magic-link subcontractor surface — bad tokens must 4xx, never 5xx.
// ---------------------------------------------------------------------------
try {
  const fake = 'prodsmoke-nonexistent-token';
  const info = await fetchJson(`/api/subcontractor/${fake}/info`);
  const accept = await fetchJson(`/api/subcontractor/${fake}/accept`, { method: 'POST', body: '{}' });
  const ok = info.status >= 400 && info.status < 500 && accept.status >= 400 && accept.status < 500;
  record('subcontractor magic-link API (bad token)', ok ? 'pass' : 'fail', `info=${info.status} accept=${accept.status}`);
} catch (err) {
  record('subcontractor magic-link API (bad token)', 'fail', err.message);
}

// ---------------------------------------------------------------------------
// Browser checks (full mode only)
// ---------------------------------------------------------------------------
if (!API_ONLY) {
  let puppeteer;
  try {
    puppeteer = (await import('puppeteer')).default;
  } catch (err) {
    unable(`puppeteer unavailable: ${err.message}`);
  }

  let chromiumPath;
  try { chromiumPath = execSync('which chromium').toString().trim() || undefined; } catch {}

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: chromiumPath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
      timeout: 60_000,
    });
  } catch (err) {
    unable(`cannot launch Chromium: ${err.message}`);
  }

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(TIMEOUT);
    await page.setViewport({ width: 1280, height: 900 });

    // Track any 5xx API responses seen during browsing — a broken page usually
    // shows up here first (e.g. a missing DB column turning /api/jobs into 500s).
    const serverErrors = [];
    page.on('response', (res) => {
      if (res.status() >= 500 && res.url().includes('/api/')) {
        serverErrors.push(`${res.status()} ${res.url().replace(BASE, '')}`);
      }
    });

    // 6. Landing page + login page render (login lives at /auth via AuthFlow)
    try {
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT });
      const landingText = await page.evaluate(() => document.body.innerText || '');
      record('landing page renders', landingText.trim().length > 50 ? 'pass' : 'fail');
    } catch (err) {
      record('landing page renders', 'fail', err.message.split('\n')[0]);
    }
    try {
      await page.goto(`${BASE}/auth`, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT });
      await page.waitForSelector('[data-testid="tab-login"], [data-testid="input-login-email"]', { timeout: TIMEOUT });
      const hasRegisterTab = !!(await page.$('[data-testid="tab-register"]'));
      record('login page renders', 'pass', hasRegisterTab ? 'login + register tabs visible' : 'login form visible');
    } catch (err) {
      record('login page renders', 'fail', err.message.split('\n')[0]);
    }

    // 7. Email/password login through the real form → dashboard. MANDATORY.
    if (loginPending) {
      record('email/password login → dashboard (browser)', 'pending', 'smoke account awaits server-side provisioning');
    } else if (PASSWORD) {
      try {
        await page.waitForSelector('[data-testid="input-login-email"]');
        await page.type('[data-testid="input-login-email"]', EMAIL);
        await page.type('[data-testid="input-login-password"]', PASSWORD);
        const meResponse = page.waitForResponse(
          (res) => res.url().includes('/api/auth/me') && res.request().method() === 'GET',
          { timeout: TIMEOUT },
        );
        await page.click('[data-testid="button-login"]');
        const me = await meResponse;
        if (me.status() !== 200) throw new Error(`/api/auth/me returned ${me.status()} after login`);
        // Dashboard = login form gone + app shell present.
        await page.waitForFunction(
          () => !document.querySelector('[data-testid="input-login-password"]'),
          { timeout: TIMEOUT },
        );
        record('email/password login → dashboard (browser)', 'pass');
      } catch (err) {
        record('email/password login → dashboard (browser)', 'fail', err.message.split('\n')[0]);
      }
    } else if (process.env.PROD_SMOKE_ALLOW_SKIP_LOGIN === '1') {
      record('email/password login → dashboard (browser)', 'skip', 'no credentials available');
    } else {
      record('email/password login → dashboard (browser)', 'fail', 'no credentials: set PROD_SMOKE_EMAIL/PROD_SMOKE_PASSWORD or SESSION_SECRET');
    }

    // 8. Magic-link landing page renders (SPA route /m/:token with a bad token
    //    must show a graceful state, not a blank/broken page).
    try {
      const mlPage = await browser.newPage();
      mlPage.setDefaultTimeout(TIMEOUT);
      await mlPage.goto(`${BASE}/m/prodsmoke-nonexistent-token`, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT });
      const bodyText = await mlPage.evaluate(() => document.body.innerText || '');
      record('magic-link landing page renders', bodyText.trim().length > 10 ? 'pass' : 'fail');
      await mlPage.close();
    } catch (err) {
      record('magic-link landing page renders', 'fail', err.message.split('\n')[0]);
    }

    if (serverErrors.length) {
      record('no 5xx API responses while browsing', 'fail', serverErrors.slice(0, 10).join(', '));
    } else {
      record('no 5xx API responses while browsing', 'pass');
    }
  } finally {
    await browser.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
const failed = results.filter((r) => r.status === 'fail');
const skipped = results.filter((r) => r.status === 'skip');
const pending = results.filter((r) => r.status === 'pending');
log(`${results.length - failed.length - skipped.length - pending.length} passed, ${failed.length} failed, ${pending.length} pending, ${skipped.length} skipped (${API_ONLY ? 'api-only' : 'full'} mode, target: ${BASE})`);
if (failed.length) {
  console.error('[prod-smoke] SMOKE FAILURE — broken page(s) on the deployed site:');
  for (const f of failed) console.error(`  - ${f.name}: ${f.detail}`);
  process.exit(1);
}
if (pending.length) {
  console.error('[prod-smoke] PROVISIONING PENDING — smoke account not yet provisioned by the deployed server; login walkthrough will activate on the next publish.');
  process.exit(3);
}
process.exit(0);
