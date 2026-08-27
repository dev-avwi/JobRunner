/**
 * Job-view timeline — phases that span across week boundaries
 *
 * Verifies that a phase whose scheduledStart falls in the previous week and
 * scheduledEnd falls mid-current-week renders at least one visible block in
 * the current week view.  Without this test a future change to the
 * week-window filter could silently drop cross-week phase blocks.
 */

import { test, expect, type Page } from '@playwright/test';
import { format, subDays, addDays } from 'date-fns';

// ---------------------------------------------------------------------------
// Shared mock helpers (mirrors job-view-dateless-phase.spec.ts)
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

const PROJECT_JOB = {
  id: 'job-crossweek-1',
  title: 'Cross-Week Phase Project',
  jobType: 'project',
  status: 'active',
  scheduledAt: null,
  scheduledTime: null,
  address: null,
  assignedTo: 'w1',
  assignments: [{ memberId: 'w1', isActive: true }],
};

/**
 * A phase that started 8 days ago (firmly in the prior week) and ends
 * 2 days from now (mid current week).  The job-view timeline should
 * render a visible block for each day of the current week that falls
 * inside this date range.
 */
function makeCrossWeekPhase() {
  const startDate = format(subDays(new Date(), 8), 'yyyy-MM-dd');
  const endDate   = format(addDays(new Date(), 2), 'yyyy-MM-dd');
  return {
    id: 'phase-crossweek-1',
    jobId: 'job-crossweek-1',
    phaseCode: 'FRAME',
    name: 'Framing',
    scheduledStart: `${startDate}T08:00:00`,
    scheduledEnd:   `${endDate}T17:00:00`,
    bookedHours: '40',
    status: 'in_progress',
    sortOrder: 1,
    assignedUserId: 'w1',
    assignedUserIds: ['w1'],
    assignedUsers: [{ id: 'w1', name: 'Alex Smith', isLead: true }],
    jobTitle: 'Cross-Week Phase Project',
    jobType: 'project',
  };
}

// ---------------------------------------------------------------------------
// Test — cross-week phase renders a visible block in the current week
// ---------------------------------------------------------------------------

test(
  'job-view timeline renders a visible block for a phase that started in the prior week and ends mid-current-week',
  async ({ page }) => {
    const CROSS_WEEK_PHASE = makeCrossWeekPhase();

    await mockBaseApis(page);

    // Serve the project job on both list and board endpoints
    await page.route('**/api/jobs', (r) => r.fulfill(json([PROJECT_JOB])));
    await page.route('**/api/dispatch/board', (r) => r.fulfill(json([PROJECT_JOB])));
    await page.route('**/api/dispatch/phases', (r) => r.fulfill(json([CROSS_WEEK_PHASE])));

    // Worker row for the timeline
    await page.route('**/api/team/members', (r) => r.fulfill(json([WORKER])));
    await page.route('**/api/team/worker-states', (r) => r.fulfill(json([])));

    // Per-job calls triggered when the job is selected in job-view mode
    await page.route(`**/api/jobs/${PROJECT_JOB.id}`, (r) => r.fulfill(json(PROJECT_JOB)));
    await page.route(`**/api/jobs/${PROJECT_JOB.id}/phases`, (r) =>
      r.fulfill(json([CROSS_WEEK_PHASE]))
    );
    await page.route(`**/api/jobs/${PROJECT_JOB.id}/materials`, (r) => r.fulfill(json([])));
    await page.route(`**/api/jobs/${PROJECT_JOB.id}/expenses`, (r) => r.fulfill(json([])));
    await page.route(`**/api/team/job-assignments/${PROJECT_JOB.id}`, (r) =>
      r.fulfill(json([]))
    );

    // Collect browser console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Navigate to the dispatch page in job-view mode with the job pre-selected
    await page.goto(`/dispatch?view=job&jobId=${PROJECT_JOB.id}`, {
      waitUntil: 'domcontentloaded',
    });

    // The dispatch board must be visible — no white screen / crash
    await expect(page.locator('[data-testid="dispatch-board"]')).toBeVisible({ timeout: 15000 });

    // The cross-week phase block must appear in the current week view.
    // data-testid="job-view-phase-<id>" is rendered for every day the phase
    // is active, so at minimum one element with this id must be visible.
    await expect(
      page.locator('[data-testid="job-view-phase-phase-crossweek-1"]').first(),
    ).toBeVisible({ timeout: 10000 });

    // No unexpected runtime errors
    const relevantErrors = consoleErrors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('net::ERR_') &&
        !e.includes('Service worker registration failed') &&
        !e.includes('Failed to load resource'),
    );
    expect(
      relevantErrors,
      `Unexpected console errors: ${relevantErrors.join('\n')}`,
    ).toHaveLength(0);
  },
);
