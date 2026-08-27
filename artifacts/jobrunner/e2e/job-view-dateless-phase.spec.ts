/**
 * Job-view timeline — phases without scheduled dates
 *
 * Verifies that the 7-day timeline in the Job view ("job" mode on the Dispatch
 * page) renders phases that have no scheduledStart / scheduledEnd as ordinary
 * single-day blocks without throwing a runtime error or leaving the page blank.
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Shared mock helpers (mirrors phase-scheduling.spec.ts)
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
  firstName: 'Alex',
  lastName: 'Smith',
  email: 'alex@example.com',
  role: 'worker',
  profileImageUrl: null,
  themeColor: null,
  isActive: true,
};

/** A project job that Alex is assigned to. */
const PROJECT_JOB = {
  id: 'job-dateless-1',
  title: 'Dateless Phase Project',
  jobType: 'project',
  status: 'active',
  scheduledAt: null,
  scheduledTime: null,
  address: null,
  assignedTo: 'w1',
  assignments: [{ memberId: 'w1', isActive: true }],
};

/** Phase with BOTH scheduledStart and scheduledEnd absent (null). */
const DATELESS_PHASE = {
  id: 'phase-dateless-1',
  jobId: 'job-dateless-1',
  phaseCode: 'FOUND',
  name: 'Foundation',
  scheduledStart: null,
  scheduledEnd: null,
  bookedHours: '4',
  status: 'not_started',
  sortOrder: 1,
  assignedUserId: 'w1',
  assignedUserIds: ['w1'],
  assignedUsers: [{ id: 'w1', name: 'Alex Smith', isLead: true }],
  jobTitle: 'Dateless Phase Project',
  jobType: 'project',
};

/** Phase with only scheduledStart set, scheduledEnd null. */
const PARTIAL_DATE_PHASE = {
  id: 'phase-partial-1',
  jobId: 'job-dateless-1',
  phaseCode: 'FRAME',
  name: 'Framing',
  scheduledStart: new Date().toISOString().slice(0, 10) + 'T08:00:00',
  scheduledEnd: null,
  bookedHours: '3',
  status: 'not_started',
  sortOrder: 2,
  assignedUserId: 'w1',
  assignedUserIds: ['w1'],
  assignedUsers: [{ id: 'w1', name: 'Alex Smith', isLead: true }],
  jobTitle: 'Dateless Phase Project',
  jobType: 'project',
};

// ---------------------------------------------------------------------------
// Test 1 — Job view renders without crashing when a phase has null dates
// ---------------------------------------------------------------------------

test('job-view timeline renders without errors when a phase has null scheduledStart and scheduledEnd', async ({ page }) => {
  await mockBaseApis(page);

  // Serve the project job on the jobs list and board
  await page.route('**/api/jobs', (r) => r.fulfill(json([PROJECT_JOB])));
  await page.route('**/api/dispatch/board', (r) => r.fulfill(json([PROJECT_JOB])));
  await page.route('**/api/dispatch/phases', (r) => r.fulfill(json([DATELESS_PHASE])));

  // Team members for the worker rows
  await page.route('**/api/team/members', (r) => r.fulfill(json([WORKER])));
  await page.route('**/api/team/worker-states', (r) => r.fulfill(json([])));

  // Per-job API calls made when a job is selected in job-view
  await page.route(`**/api/jobs/${PROJECT_JOB.id}`, (r) => r.fulfill(json(PROJECT_JOB)));
  await page.route(`**/api/jobs/${PROJECT_JOB.id}/phases`, (r) => r.fulfill(json([DATELESS_PHASE])));
  await page.route(`**/api/jobs/${PROJECT_JOB.id}/materials`, (r) => r.fulfill(json([])));
  await page.route(`**/api/jobs/${PROJECT_JOB.id}/expenses`, (r) => r.fulfill(json([])));
  await page.route(`**/api/team/job-assignments/${PROJECT_JOB.id}`, (r) => r.fulfill(json([])));

  // Collect browser console errors
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // Navigate directly to the dispatch page in job-view mode with the job selected
  await page.goto(`/dispatch?view=job&jobId=${PROJECT_JOB.id}`, { waitUntil: 'domcontentloaded' });

  // Dispatch board must be visible (no white screen / full crash)
  await expect(page.locator('[data-testid="dispatch-board"]')).toBeVisible({ timeout: 15000 });

  // The dateless phase block must appear in the timeline (rendered as a
  // single-day block on the first day of the view — not silently hidden).
  await expect(
    page.locator('[data-testid="job-view-phase-phase-dateless-1"]'),
  ).toBeVisible({ timeout: 10000 });

  // No runtime errors must have been thrown.
  // Filter out pre-existing environment noise (SW registration in test runner,
  // 404s for optional resources like favicons) that are unrelated to this test.
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
// Test 2 — Phase with only scheduledStart (scheduledEnd null) renders safely
// ---------------------------------------------------------------------------

test('job-view timeline renders safely when a phase has scheduledStart but null scheduledEnd', async ({ page }) => {
  await mockBaseApis(page);

  await page.route('**/api/jobs', (r) => r.fulfill(json([PROJECT_JOB])));
  await page.route('**/api/dispatch/board', (r) => r.fulfill(json([PROJECT_JOB])));
  await page.route('**/api/dispatch/phases', (r) => r.fulfill(json([PARTIAL_DATE_PHASE])));

  await page.route('**/api/team/members', (r) => r.fulfill(json([WORKER])));
  await page.route('**/api/team/worker-states', (r) => r.fulfill(json([])));

  await page.route(`**/api/jobs/${PROJECT_JOB.id}`, (r) => r.fulfill(json(PROJECT_JOB)));
  await page.route(`**/api/jobs/${PROJECT_JOB.id}/phases`, (r) => r.fulfill(json([PARTIAL_DATE_PHASE])));
  await page.route(`**/api/jobs/${PROJECT_JOB.id}/materials`, (r) => r.fulfill(json([])));
  await page.route(`**/api/jobs/${PROJECT_JOB.id}/expenses`, (r) => r.fulfill(json([])));
  await page.route(`**/api/team/job-assignments/${PROJECT_JOB.id}`, (r) => r.fulfill(json([])));

  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto(`/dispatch?view=job&jobId=${PROJECT_JOB.id}`, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('[data-testid="dispatch-board"]')).toBeVisible({ timeout: 15000 });

  // The partial-date phase block must appear as a single-day block (not hidden).
  await expect(
    page.locator('[data-testid="job-view-phase-phase-partial-1"]'),
  ).toBeVisible({ timeout: 10000 });

  const relevantErrors = consoleErrors.filter(
    (e) =>
      !e.includes('favicon') &&
      !e.includes('net::ERR_') &&
      !e.includes('Service worker registration failed') &&
      !e.includes('Failed to load resource'),
  );
  expect(relevantErrors, `Unexpected console errors: ${relevantErrors.join('\n')}`).toHaveLength(0);
});
