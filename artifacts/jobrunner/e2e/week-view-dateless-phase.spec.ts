/**
 * Week-view phase row — phases without scheduled dates
 *
 * Verifies that the WeekView worker-row phase-chip path (data-testid="week-phase-<id>")
 * handles phases with null scheduledStart / scheduledEnd gracefully:
 *   • The board renders without a white-screen or runtime exception.
 *   • No unexpected console errors are thrown.
 *   • The worker row is visible, confirming the week-view rendered properly.
 *   • No errant "week-phase-*" chip is rendered for a date-less phase
 *     (phaseOnDate returns false → phase is skipped, not crashed).
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Shared mock helpers
// ---------------------------------------------------------------------------

const AUTH_USER = {
  id: 1,
  email: 'test@example.com',
  name: 'Test Owner',
  fullName: 'Test Owner',
  role: 'owner',
  businessId: 1,
  subscriptionTier: 'team',
};

const BUSINESS_SETTINGS = {
  id: 1,
  businessId: 1,
  businessName: 'Test Business',
  onboardingCompleted: true,
  hasSeenWalkthrough: true,
  themeMode: 'light',
  primaryColor: '',
  customThemeEnabled: false,
  tradeType: 'general',
  scheduleStartHour: 6,
  scheduleEndHour: 20,
};

const SUBSCRIPTION_USAGE = {
  subscriptionTier: 'team',
  jobsUsed: 0,
  jobsLimit: null,
  teamMembersUsed: 0,
  teamMembersLimit: null,
  isFoundingMember: false,
};

const OPS_HEALTH_OK = {
  conflictCount: 0,
  overdueJobs: 0,
  unassignedJobs: 0,
  overCapacityWorkers: 0,
  overdueInvoices: 0,
  conflicts: [],
};

function json(body: unknown) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify(body) };
}

async function mockBaseApis(page: Page) {
  await page.route('**/api/auth/me', (r) => r.fulfill(json(AUTH_USER)));
  await page.route('**/api/auth/my-businesses', (r) =>
    r.fulfill(json([{ id: 1, name: 'Test Business' }]))
  );
  await page.route('**/api/team/my-role', (r) => r.fulfill({ status: 404, body: '' }));
  await page.route('**/api/business-settings', (r) => r.fulfill(json(BUSINESS_SETTINGS)));
  await page.route('**/api/subscription/usage', (r) => r.fulfill(json(SUBSCRIPTION_USAGE)));
  await page.route('**/api/dispatch/board', (r) => r.fulfill(json([])));
  await page.route('**/api/dispatch/resources', (r) =>
    r.fulfill(json({ teamMembers: [], vehicles: [] }))
  );
  await page.route('**/api/ops/health', (r) => r.fulfill(json(OPS_HEALTH_OK)));
  await page.route('**/api/ops/job-aging', (r) =>
    r.fulfill(json({ totalAging: 0, criticalCount: 0, agingJobs: [] }))
  );
  await page.route('**/api/jobs', (r) => r.fulfill(json([])));
  await page.route('**/api/clients', (r) => r.fulfill(json([])));
  await page.route('**/api/team/members', (r) => r.fulfill(json([])));
  await page.route('**/api/team/worker-states', (r) => r.fulfill(json([])));
  await page.route('**/api/ai/schedule-suggestions**', (r) =>
    r.fulfill(json({ suggestions: [] }))
  );
  await page.route('**/api/notifications/**', (r) =>
    r.fulfill(json({ notifications: [], unreadCount: 0 }))
  );
  await page.route('**/api/integrations/health', (r) =>
    r.fulfill(json({ allReady: true }))
  );
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const WORKER = {
  id: 'w1',
  memberId: 'w1',
  firstName: 'Jordan',
  lastName: 'Lee',
  email: 'jordan@example.com',
  role: 'worker',
  profileImageUrl: null,
  themeColor: null,
  isActive: true,
};

/** Phase with BOTH scheduledStart and scheduledEnd absent (null). */
const DATELESS_PHASE = {
  id: 'week-dateless-phase-1',
  jobId: 'job-wv-1',
  phaseCode: 'SLAB',
  name: 'Slab Pour',
  scheduledStart: null,
  scheduledEnd: null,
  bookedHours: '6',
  status: 'not_started',
  sortOrder: 1,
  assignedUserId: 'w1',
  assignedUserIds: ['w1'],
  assignedUsers: [{ id: 'w1', name: 'Jordan Lee', isLead: true }],
  jobTitle: 'Week View Dateless Job',
  jobType: 'project',
};

/** Phase with scheduledStart set but scheduledEnd null. */
const PARTIAL_DATE_PHASE = {
  id: 'week-partial-phase-1',
  jobId: 'job-wv-1',
  phaseCode: 'FRAME',
  name: 'Framing',
  scheduledStart: new Date().toISOString().slice(0, 10) + 'T08:00:00',
  scheduledEnd: null,
  bookedHours: '4',
  status: 'not_started',
  sortOrder: 2,
  assignedUserId: 'w1',
  assignedUserIds: ['w1'],
  assignedUsers: [{ id: 'w1', name: 'Jordan Lee', isLead: true }],
  jobTitle: 'Week View Dateless Job',
  jobType: 'project',
};

// ---------------------------------------------------------------------------
// Test 1 — Week view renders without crashing when a phase has null dates
// ---------------------------------------------------------------------------

test('week-view grid renders without errors when a phase has null scheduledStart and scheduledEnd', async ({ page }) => {
  await mockBaseApis(page);

  // Provide the dateless phase via the /dispatch/phases endpoint
  await page.route('**/api/dispatch/phases', (r) => r.fulfill(json([DATELESS_PHASE])));

  // Provide a worker so the week-view worker rows render
  await page.route('**/api/team/members', (r) => r.fulfill(json([WORKER])));
  await page.route('**/api/team/worker-states', (r) => r.fulfill(json([])));

  // Collect browser console errors
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // Navigate to the dispatch page in week view
  await page.goto('/dispatch?view=week', { waitUntil: 'domcontentloaded' });

  // The dispatch board must be visible (no white screen / full crash)
  await expect(page.locator('[data-testid="dispatch-board"]')).toBeVisible({ timeout: 15000 });

  // A worker row must be present, confirming WeekView actually rendered
  await expect(page.getByText('Jordan Lee').first()).toBeVisible({ timeout: 10000 });

  // A date-less phase must NOT produce a week-phase chip — phaseOnDate returns
  // false for null scheduledStart, so it is silently skipped rather than crashing.
  await expect(
    page.locator('[data-testid="week-phase-week-dateless-phase-1"]'),
  ).toHaveCount(0);

  // No runtime errors must have been thrown.
  const relevantErrors = consoleErrors.filter(
    (e) =>
      !e.includes('favicon') &&
      !e.includes('net::ERR_') &&
      !e.includes('Service worker registration failed') &&
      !e.includes('Failed to load resource'),
  );
  expect(relevantErrors, `Unexpected console errors: ${relevantErrors.join('\n')}`).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// Test 2 — Week view renders safely when scheduledEnd is null but start is set
// ---------------------------------------------------------------------------

test('week-view grid renders safely when a phase has scheduledStart but null scheduledEnd', async ({ page }) => {
  await mockBaseApis(page);

  // Provide the partial-date phase via /dispatch/phases
  await page.route('**/api/dispatch/phases', (r) => r.fulfill(json([PARTIAL_DATE_PHASE])));

  // Provide a worker so the week-view worker rows render
  await page.route('**/api/team/members', (r) => r.fulfill(json([WORKER])));
  await page.route('**/api/team/worker-states', (r) => r.fulfill(json([])));

  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('/dispatch?view=week', { waitUntil: 'domcontentloaded' });

  // Board must be visible
  await expect(page.locator('[data-testid="dispatch-board"]')).toBeVisible({ timeout: 15000 });

  // Worker row must be visible, confirming WeekView rendered
  await expect(page.getByText('Jordan Lee').first()).toBeVisible({ timeout: 10000 });

  // A phase with only scheduledStart set (scheduledEnd null) renders as a
  // single-day chip on its start day — the week-phase element should appear
  // in the current week if today falls within the week shown.
  // We don't assert its presence here (depends on current week), but we do
  // assert that whatever happens, there are no runtime errors.
  const relevantErrors = consoleErrors.filter(
    (e) =>
      !e.includes('favicon') &&
      !e.includes('net::ERR_') &&
      !e.includes('Service worker registration failed') &&
      !e.includes('Failed to load resource'),
  );
  expect(relevantErrors, `Unexpected console errors: ${relevantErrors.join('\n')}`).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// Test 3 — Week view renders safely when both date-less and dated phases coexist
// ---------------------------------------------------------------------------

test('week-view grid renders without errors when date-less and dated phases coexist', async ({ page }) => {
  await mockBaseApis(page);

  // Both phases present simultaneously — the dateless one should be silently
  // skipped without poisoning the render of the dated one.
  await page.route('**/api/dispatch/phases', (r) =>
    r.fulfill(json([DATELESS_PHASE, PARTIAL_DATE_PHASE]))
  );

  await page.route('**/api/team/members', (r) => r.fulfill(json([WORKER])));
  await page.route('**/api/team/worker-states', (r) => r.fulfill(json([])));

  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('/dispatch?view=week', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('[data-testid="dispatch-board"]')).toBeVisible({ timeout: 15000 });

  // Worker row present
  await expect(page.getByText('Jordan Lee').first()).toBeVisible({ timeout: 10000 });

  // The fully date-less phase chip must not appear (silently filtered)
  await expect(
    page.locator('[data-testid="week-phase-week-dateless-phase-1"]'),
  ).toHaveCount(0);

  // No runtime errors
  const relevantErrors = consoleErrors.filter(
    (e) =>
      !e.includes('favicon') &&
      !e.includes('net::ERR_') &&
      !e.includes('Service worker registration failed') &&
      !e.includes('Failed to load resource'),
  );
  expect(relevantErrors, `Unexpected console errors: ${relevantErrors.join('\n')}`).toHaveLength(0);
});
