/**
 * Insights period figures — API contract tests (Task #310).
 *
 * Pins the behavior web + mobile Insights depend on for:
 *   GET /api/dashboard/kpis
 *   GET /api/dashboard/profit-snapshot
 *   GET /api/dashboard/cashflow
 *
 * Covers:
 *  (a) no params -> legacy today/week/month windows unchanged (period: null)
 *  (b) valid startDate/endDate -> period-scoped totals + period echo
 *  (c) cashflow keeps BOTH canonical fields and Insights aliases with equal
 *      values (collectedThisMonth/thisMonthCollected, collectedLastMonth/
 *      lastMonthCollected, overdueInvoices/overdueBreakdown,
 *      revenueByWeek/weeklyCollections)
 *  (d) invalid/reversed ranges fall back to legacy windows (period: null)
 *
 * Uses an ISOLATED seeded test user (created + torn down here — never the
 * shared demo account) with deterministic invoice fixtures, so every total
 * asserted below is an exact expected number.
 *
 * Run against the dev server (shares DATABASE_URL with the test process):
 *   BASE_URL=http://localhost:5000 tsx tests/insights-period.test.ts
 * Or via the orchestrating runner (starts the server if needed):
 *   bash tests/run-insights-tests.sh
 */

import { db } from '../server/storage';
import { users, clients, invoices, businessSettings } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { AuthService } from '../server/auth';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

const TEST_EMAIL = 'insights-contract-test@jobrunner.test';
const TEST_PASSWORD = 'Insights#Test1234';

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

const isNum = (v: any) => typeof v === 'number' && isFinite(v);

// ── Deterministic fixture amounts ───────────────────────────────────────────
const CUR_TOTAL = 250; // paid 1 minute ago (today / this week / this month)
const LAST_TOTAL = 400; // paid mid-last-month
const OLD_TOTAL = 100; // paid 2020-05-15
const UNPAID_TOTAL = 75; // status 'sent', due in 30 days
const ALL_PAID = CUR_TOTAL + LAST_TOTAL + OLD_TOTAL; // 750

async function teardown() {
  // Deleting the user cascades invoices/clients/business_settings (FK on delete cascade)
  await db.delete(users).where(eq(users.email, TEST_EMAIL));
}

async function seed() {
  await teardown(); // idempotent: remove any leftovers from a previous run

  const passwordHash = await AuthService.hashPassword(TEST_PASSWORD);
  const [user] = await db.insert(users).values({
    email: TEST_EMAIL,
    username: `insights_test_${Date.now().toString(36)}`,
    password: passwordHash,
    firstName: 'Insights',
    lastName: 'ContractTest',
    emailVerified: true,
    isActive: true,
  } as any).returning();

  // Onboarding guard 403s core routes for un-onboarded users — mark complete.
  await db.insert(businessSettings).values({
    userId: user.id,
    businessName: 'Insights Contract Test Pty Ltd',
    onboardingCompleted: true,
  } as any);

  const [client] = await db.insert(clients).values({
    userId: user.id,
    name: 'Fixture Client',
  } as any).returning();

  const now = new Date();
  const paidCur = new Date(now.getTime() - 60 * 1000);
  const lastMonthMid = new Date(now.getFullYear(), now.getMonth() - 1, 15, 12, 0, 0);
  const paidOld = new Date('2020-05-15T12:00:00.000Z');
  const dueFuture = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const suffix = Date.now().toString(36);

  const mk = (n: string, total: number, status: string, paidAt: Date | null, dueDate: Date | null) => ({
    userId: user.id,
    clientId: client.id,
    number: `INS-TEST-${n}-${suffix}`,
    title: `Insights fixture ${n}`,
    status,
    subtotal: total.toFixed(2),
    total: total.toFixed(2),
    paidAt,
    dueDate,
  });

  await db.insert(invoices).values([
    mk('CUR', CUR_TOTAL, 'paid', paidCur, null),
    mk('LAST', LAST_TOTAL, 'paid', lastMonthMid, null),
    mk('OLD', OLD_TOTAL, 'paid', paidOld, null),
    mk('UNPAID', UNPAID_TOTAL, 'sent', null, dueFuture),
  ] as any);

  return user;
}

async function main() {
  await seed();

  // ── Login (explicit sessionToken contract — fail loudly if absent) ──────
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  if (!loginRes.ok) {
    throw new Error(`Login for seeded test user failed (status ${loginRes.status}): ${await loginRes.text()}`);
  }
  const login = await loginRes.json();
  if (typeof login.sessionToken !== 'string' || !login.sessionToken) {
    throw new Error(`/api/auth/login response is missing the sessionToken field: ${JSON.stringify(Object.keys(login))}`);
  }
  const auth = { authorization: `Bearer ${login.sessionToken}` };

  const get = async (path: string) => {
    const res = await fetch(`${BASE_URL}${path}`, { headers: auth });
    return { status: res.status, body: res.ok ? await res.json() : await res.text() };
  };

  // Ranges
  const wideStart = new Date('2020-01-01T00:00:00.000Z'); // contains all 3 paid invoices
  const wideEnd = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const wideQS = `startDate=${encodeURIComponent(wideStart.toISOString())}&endDate=${encodeURIComponent(wideEnd.toISOString())}`;
  const emptyStart = new Date('1970-01-01T00:00:00.000Z'); // contains nothing
  const emptyEnd = new Date('1970-02-01T00:00:00.000Z');
  const emptyQS = `startDate=${encodeURIComponent(emptyStart.toISOString())}&endDate=${encodeURIComponent(emptyEnd.toISOString())}`;

  // ── /api/dashboard/kpis ────────────────────────────────────────────────
  console.log('KPIs:');
  {
    const legacy = await get('/api/dashboard/kpis');
    check('no params -> 200', legacy.status === 200, `status=${legacy.status}`);
    const k = legacy.body;
    check('no params -> period is null (legacy windows)', k.period === null, JSON.stringify(k.period));
    check('no params -> monthlyEarnings = this-month paid only', k.monthlyEarnings === CUR_TOTAL, `${k.monthlyEarnings} vs ${CUR_TOTAL}`);
    check('no params -> weeklyEarnings = this-week paid only', k.weeklyEarnings === CUR_TOTAL, `${k.weeklyEarnings} vs ${CUR_TOTAL}`);
    check('no params -> paid-in-period = this-month invoice', k.paidInvoicesCount === 1 && k.paidInvoicesTotal === CUR_TOTAL, JSON.stringify({ c: k.paidInvoicesCount, t: k.paidInvoicesTotal }));
    check('no params -> unpaid invoice counted', k.unpaidInvoicesCount === 1 && k.unpaidInvoicesTotal === UNPAID_TOTAL, JSON.stringify({ c: k.unpaidInvoicesCount, t: k.unpaidInvoicesTotal }));

    const wide = (await get(`/api/dashboard/kpis?${wideQS}`)).body;
    check('wide range -> period echo matches request', wide.period?.start === wideStart.toISOString() && wide.period?.end === wideEnd.toISOString(), JSON.stringify(wide.period));
    check('wide range -> paid totals scoped to range (all 3)', wide.paidInvoicesCount === 3 && wide.paidInvoicesTotal === ALL_PAID, JSON.stringify({ c: wide.paidInvoicesCount, t: wide.paidInvoicesTotal }));
    check('wide range -> weekly/monthly earnings follow the range', wide.weeklyEarnings === ALL_PAID && wide.monthlyEarnings === ALL_PAID, JSON.stringify({ w: wide.weeklyEarnings, m: wide.monthlyEarnings }));
    check('wide range -> non-period KPIs unchanged', wide.unpaidInvoicesCount === 1 && wide.unpaidInvoicesTotal === UNPAID_TOTAL, JSON.stringify({ c: wide.unpaidInvoicesCount, t: wide.unpaidInvoicesTotal }));

    const empty = (await get(`/api/dashboard/kpis?${emptyQS}`)).body;
    check('empty range -> zero paid totals', empty.paidInvoicesCount === 0 && empty.paidInvoicesTotal === 0 && empty.weeklyEarnings === 0 && empty.monthlyEarnings === 0, JSON.stringify({ c: empty.paidInvoicesCount, t: empty.paidInvoicesTotal, w: empty.weeklyEarnings, m: empty.monthlyEarnings }));
    check('empty range -> still echoes period', empty.period?.start === emptyStart.toISOString() && empty.period?.end === emptyEnd.toISOString(), JSON.stringify(empty.period));

    const reversed = (await get(`/api/dashboard/kpis?startDate=${encodeURIComponent(wideEnd.toISOString())}&endDate=${encodeURIComponent(wideStart.toISOString())}`)).body;
    check('reversed range -> legacy (period null)', reversed.period === null && reversed.monthlyEarnings === CUR_TOTAL, JSON.stringify({ p: reversed.period, m: reversed.monthlyEarnings }));
    const garbage = (await get('/api/dashboard/kpis?startDate=not-a-date&endDate=also-not')).body;
    check('garbage dates -> legacy (period null, legacy totals)', garbage.period === null && garbage.monthlyEarnings === CUR_TOTAL && garbage.weeklyEarnings === CUR_TOTAL, JSON.stringify({ p: garbage.period, m: garbage.monthlyEarnings, w: garbage.weeklyEarnings }));
  }

  // ── /api/dashboard/profit-snapshot ─────────────────────────────────────
  console.log('Profit snapshot:');
  {
    const legacy = await get('/api/dashboard/profit-snapshot');
    check('no params -> 200', legacy.status === 200, `status=${legacy.status}`);
    const p = legacy.body;
    check('no params -> period is null (legacy month window)', p.period === null, JSON.stringify(p.period));
    check('no params -> revenueToday = today paid', p.revenueToday === CUR_TOTAL, `${p.revenueToday} vs ${CUR_TOTAL}`);
    check('no params -> revenueThisWeek = this-week paid', p.revenueThisWeek === CUR_TOTAL, `${p.revenueThisWeek} vs ${CUR_TOTAL}`);
    check('no params -> revenueThisMonth = this-month paid', p.revenueThisMonth === CUR_TOTAL, `${p.revenueThisMonth} vs ${CUR_TOTAL}`);
    check('no params -> grossProfit = revenue (no labour/material fixtures)', p.grossProfit === CUR_TOTAL && p.labourCostThisMonth === 0 && p.materialCostThisMonth === 0, JSON.stringify({ gp: p.grossProfit, l: p.labourCostThisMonth, m: p.materialCostThisMonth }));
    check('no params -> grossMargin is a finite number', isNum(p.grossMargin), JSON.stringify(p.grossMargin));

    const wide = (await get(`/api/dashboard/profit-snapshot?${wideQS}`)).body;
    check('wide range -> period echo matches request', wide.period?.start === wideStart.toISOString() && wide.period?.end === wideEnd.toISOString(), JSON.stringify(wide.period));
    check('wide range -> period revenue = all paid invoices', wide.revenueThisMonth === ALL_PAID, `${wide.revenueThisMonth} vs ${ALL_PAID}`);
    check('wide range -> today/week figures unchanged by range', wide.revenueToday === CUR_TOTAL && wide.revenueThisWeek === CUR_TOTAL, JSON.stringify({ t: wide.revenueToday, w: wide.revenueThisWeek }));

    const empty = (await get(`/api/dashboard/profit-snapshot?${emptyQS}`)).body;
    check('empty range -> zero period revenue/costs/profit', empty.revenueThisMonth === 0 && empty.labourCostThisMonth === 0 && empty.grossProfit === 0, JSON.stringify({ r: empty.revenueThisMonth, l: empty.labourCostThisMonth, gp: empty.grossProfit }));

    const reversed = (await get(`/api/dashboard/profit-snapshot?startDate=${encodeURIComponent(wideEnd.toISOString())}&endDate=${encodeURIComponent(wideStart.toISOString())}`)).body;
    check('reversed range -> legacy (period null, legacy revenue)', reversed.period === null && reversed.revenueThisMonth === CUR_TOTAL, JSON.stringify({ p: reversed.period, r: reversed.revenueThisMonth }));
  }

  // ── /api/dashboard/cashflow ────────────────────────────────────────────
  console.log('Cashflow:');
  {
    // Alias contract: both canonical + alias names present and EQUAL.
    const assertAliases = (body: any, label: string) => {
      check(`${label}: has collectedThisMonth AND thisMonthCollected, equal`, isNum(body.collectedThisMonth) && isNum(body.thisMonthCollected) && body.collectedThisMonth === body.thisMonthCollected, JSON.stringify({ c: body.collectedThisMonth, a: body.thisMonthCollected }));
      check(`${label}: has collectedLastMonth AND lastMonthCollected, equal`, isNum(body.collectedLastMonth) && isNum(body.lastMonthCollected) && body.collectedLastMonth === body.lastMonthCollected, JSON.stringify({ c: body.collectedLastMonth, a: body.lastMonthCollected }));
      check(`${label}: overdueBreakdown mirrors overdueInvoices`, Array.isArray(body.overdueBreakdown) && JSON.stringify(body.overdueBreakdown) === JSON.stringify(body.overdueInvoices), undefined);
      check(`${label}: weeklyCollections mirrors revenueByWeek`, Array.isArray(body.weeklyCollections) && JSON.stringify(body.weeklyCollections) === JSON.stringify(body.revenueByWeek), undefined);
    };

    const legacy = await get('/api/dashboard/cashflow');
    check('no params -> 200', legacy.status === 200, `status=${legacy.status}`);
    const c = legacy.body;
    check('no params -> period is null (legacy month windows)', c.period === null, JSON.stringify(c.period));
    assertAliases(c, 'no params');
    check('no params -> thisMonthCollected = this-month paid', c.thisMonthCollected === CUR_TOTAL, `${c.thisMonthCollected} vs ${CUR_TOTAL}`);
    check('no params -> lastMonthCollected = last-month paid', c.lastMonthCollected === LAST_TOTAL, `${c.lastMonthCollected} vs ${LAST_TOTAL}`);
    check('no params -> outstandingTotal = open invoice', c.outstandingTotal === UNPAID_TOTAL, `${c.outstandingTotal} vs ${UNPAID_TOTAL}`);
    check('no params -> nothing overdue (due date is future)', c.overdueCount === 0 && c.overdueTotal === 0 && c.overdueBreakdown.length === 0, JSON.stringify({ c: c.overdueCount, t: c.overdueTotal }));

    const wide = (await get(`/api/dashboard/cashflow?${wideQS}`)).body;
    check('wide range -> period echo matches request', wide.period?.start === wideStart.toISOString() && wide.period?.end === wideEnd.toISOString(), JSON.stringify(wide.period));
    assertAliases(wide, 'ranged');
    check('wide range -> collected scoped to range (all 3 paid)', wide.thisMonthCollected === ALL_PAID, `${wide.thisMonthCollected} vs ${ALL_PAID}`);
    check('wide range -> prior equal-length window empty', wide.lastMonthCollected === 0, `${wide.lastMonthCollected}`);
    check('wide range -> weeklyCollections nonempty and mirrors range', wide.weeklyCollections.length > 0, JSON.stringify(wide.weeklyCollections));
    check('range does not affect overdue/outstanding figures', wide.overdueTotal === c.overdueTotal && wide.outstandingTotal === c.outstandingTotal, JSON.stringify({ w: [wide.overdueTotal, wide.outstandingTotal], l: [c.overdueTotal, c.outstandingTotal] }));

    const empty = (await get(`/api/dashboard/cashflow?${emptyQS}`)).body;
    check('empty range -> zero collected both periods, no weekly rows', empty.thisMonthCollected === 0 && empty.lastMonthCollected === 0 && empty.weeklyCollections.length === 0, JSON.stringify({ t: empty.thisMonthCollected, l: empty.lastMonthCollected, w: empty.weeklyCollections.length }));

    const reversed = (await get(`/api/dashboard/cashflow?startDate=${encodeURIComponent(wideEnd.toISOString())}&endDate=${encodeURIComponent(wideStart.toISOString())}`)).body;
    check('reversed range -> legacy (period null, legacy totals)', reversed.period === null && reversed.thisMonthCollected === CUR_TOTAL && reversed.lastMonthCollected === LAST_TOTAL, JSON.stringify({ p: reversed.period, t: reversed.thisMonthCollected, l: reversed.lastMonthCollected }));
    assertAliases(reversed, 'reversed-range fallback');
  }

  // Unauthenticated access is denied on all three
  const anonStatuses = await Promise.all(
    ['/api/dashboard/kpis', '/api/dashboard/profit-snapshot', '/api/dashboard/cashflow'].map(
      async p => (await fetch(`${BASE_URL}${p}`)).status
    )
  );
  check('all three endpoints require auth', anonStatuses.every(s => s === 401), anonStatuses.join(','));

  // Explicit session cleanup (test user row is deleted in finally regardless)
  await fetch(`${BASE_URL}/api/auth/logout`, { method: 'POST', headers: auth }).catch(() => {});
}

main()
  .catch((e) => {
    failed++;
    console.error('Test run crashed:', e);
  })
  .finally(async () => {
    try { await teardown(); } catch (e) { console.error('Teardown failed:', e); }
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  });
