import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const AUTH_USER = {
  id: 1,
  email: 'owner@example.com',
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
};

const SUBSCRIPTION_USAGE = {
  subscriptionTier: 'team',
  jobsUsed: 0,
  jobsLimit: null,
  teamMembersUsed: 0,
  teamMembersLimit: null,
  isFoundingMember: false,
};

function json(body: unknown) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify(body) };
}

/**
 * Mock the minimum set of APIs needed for the main authenticated shell to
 * render without errors, then navigate to the full unassigned-phases page.
 */
async function mockBaseApis(page: Page) {
  await page.route('**/api/auth/me', (r) => r.fulfill(json(AUTH_USER)));
  await page.route('**/api/auth/my-businesses', (r) =>
    r.fulfill(json([{ id: 1, name: 'Test Business' }]))
  );
  // 404 from my-role → treated as owner (no team-member record = business owner)
  await page.route('**/api/team/my-role', (r) => r.fulfill({ status: 404, body: '' }));
  await page.route('**/api/business-settings', (r) => r.fulfill(json(BUSINESS_SETTINGS)));
  await page.route('**/api/subscription/usage', (r) => r.fulfill(json(SUBSCRIPTION_USAGE)));
  await page.route('**/api/notifications/**', (r) =>
    r.fulfill(json({ notifications: [], unreadCount: 0 }))
  );
  await page.route('**/api/integrations/health', (r) =>
    r.fulfill(json({ allReady: true }))
  );
  await page.route('**/api/jobs', (r) => r.fulfill(json([])));
  await page.route('**/api/clients', (r) => r.fulfill(json([])));
  await page.route('**/api/team/members', (r) => r.fulfill(json([])));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build an ISO string for a date offset by `offsetMs` from now, in
 * UTC. The endpoint returns UTC timestamps from Postgres.
 */
function isoOffset(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

const H = 60 * 60 * 1000;

function makePhase(overrides: Partial<{
  id: string;
  jobId: string;
  name: string;
  jobTitle: string;
  scheduledStart: string | null;
}> = {}) {
  return {
    id: 'phase-1',
    jobId: 'job-1',
    phaseCode: 'F01',
    name: 'Foundation',
    description: null,
    scheduledStart: null,
    scheduledEnd: null,
    status: 'not_started',
    sortOrder: 1,
    assignedUserId: null,
    jobTitle: 'Build Project',
    ...overrides,
  };
}

async function gotoUnassignedPage(page: Page) {
  await page.goto('/phases/unassigned', { waitUntil: 'domcontentloaded' });
  // Confirm the route guard did not redirect away
  await expect(page).toHaveURL(/\/phases\/unassigned/, { timeout: 10000 });
  await expect(page.locator('[data-testid="unassigned-phases-page"]')).toBeVisible({ timeout: 15000 });
}

// ---------------------------------------------------------------------------
// Tests — full list page at /phases/unassigned
// ---------------------------------------------------------------------------

test('shows phase rows when unassigned phases exist', async ({ page }) => {
  await mockBaseApis(page);
  const phase = makePhase({ scheduledStart: isoOffset(5 * 24 * H) });
  await page.route('**/api/phases/unassigned', (r) =>
    r.fulfill(json({ phases: [phase], teamMembers: [] }))
  );

  await gotoUnassignedPage(page);

  const row = page.locator('[data-testid="unassigned-phase-row-phase-1"]');
  await expect(row).toBeVisible({ timeout: 10000 });
  await expect(row).toContainText('Foundation');
  await expect(row).toContainText('Build Project');
});

test('shows empty state when there are no unassigned phases', async ({ page }) => {
  await mockBaseApis(page);
  await page.route('**/api/phases/unassigned', (r) =>
    r.fulfill(json({ phases: [], teamMembers: [] }))
  );

  await gotoUnassignedPage(page);

  await expect(page.locator('[data-testid="unassigned-phase-row-phase-1"]')).not.toBeVisible();
  await expect(page.locator('text=No unassigned phases')).toBeVisible({ timeout: 10000 });
});

test('shows Urgent badge for phases starting within 48 hours', async ({ page }) => {
  await mockBaseApis(page);
  // Phase starting in 24 hours — within the 48 h urgency window
  const phase = makePhase({ scheduledStart: isoOffset(24 * H) });
  await page.route('**/api/phases/unassigned', (r) =>
    r.fulfill(json({ phases: [phase], teamMembers: [] }))
  );

  await gotoUnassignedPage(page);

  await expect(page.locator('[data-testid="badge-urgent-phase-1"]')).toBeVisible({ timeout: 10000 });
});

test('shows Overdue badge for phases whose start date has already passed', async ({ page }) => {
  await mockBaseApis(page);
  // Phase scheduled 2 days ago
  const phase = makePhase({ scheduledStart: isoOffset(-2 * 24 * H) });
  await page.route('**/api/phases/unassigned', (r) =>
    r.fulfill(json({ phases: [phase], teamMembers: [] }))
  );

  await gotoUnassignedPage(page);

  await expect(page.locator('[data-testid="badge-overdue-phase-1"]')).toBeVisible({ timeout: 10000 });
});

test('clicking a phase row navigates to the job phases tab', async ({ page }) => {
  await mockBaseApis(page);
  const phase = makePhase({ scheduledStart: isoOffset(5 * 24 * H) });
  await page.route('**/api/phases/unassigned', (r) =>
    r.fulfill(json({ phases: [phase], teamMembers: [] }))
  );
  // Stub the job detail page so navigation can complete
  await page.route('**/api/jobs/job-1', (r) =>
    r.fulfill(json({ id: 'job-1', title: 'Build Project', status: 'in_progress' }))
  );

  await gotoUnassignedPage(page);

  const row = page.locator('[data-testid="unassigned-phase-row-phase-1"]');
  await expect(row).toBeVisible({ timeout: 10000 });
  await row.click();

  // Should navigate to /jobs/job-1?tab=phases
  await expect(page).toHaveURL(/\/jobs\/job-1/, { timeout: 10000 });
});

// ---------------------------------------------------------------------------
// Tests — UnassignedPhasesWidget embedded on the Owner/Manager Dashboard
// ---------------------------------------------------------------------------

/**
 * Stub every API the dashboard shell fires on first load so the page can
 * reach the `owner-manager-dashboard` testid without hitting real network.
 * `/api/phases/unassigned` is intentionally left out so each test can
 * supply its own fixture.
 */
async function mockDashboardApis(page: Page) {
  const emptyUnified = {
    user: AUTH_USER,
    businessSettings: BUSINESS_SETTINGS,
    subscriptionUsage: SUBSCRIPTION_USAGE,
    kpis: null,
    jobsToday: [],
    teamPresence: [],
    allJobs: [],
    unassignedJobs: [],
    activityFeed: [],
    integrationsHealthFull: { allReady: true },
    cashflow: null,
    profitSnapshot: null,
    actionCenter: null,
    teamMyRole: null,
    teamMembers: [],
    myJobs: [],
    availableJobs: [],
    activeTimeEntry: null,
    timeTrackingDashboard: null,
  };

  await page.route('**/api/dashboard/unified', (r) => r.fulfill(json(emptyUnified)));
  await page.route('**/api/auth/me', (r) => r.fulfill(json(AUTH_USER)));
  await page.route('**/api/auth/my-businesses', (r) =>
    r.fulfill(json([{ id: 1, name: 'Test Business' }]))
  );
  await page.route('**/api/team/my-role', (r) => r.fulfill({ status: 404, body: '' }));
  await page.route('**/api/business-settings', (r) => r.fulfill(json(BUSINESS_SETTINGS)));
  await page.route('**/api/subscription/usage', (r) => r.fulfill(json(SUBSCRIPTION_USAGE)));
  await page.route('**/api/notifications/**', (r) =>
    r.fulfill(json({ notifications: [], unreadCount: 0 }))
  );
  await page.route('**/api/integrations/health', (r) => r.fulfill(json({ allReady: true })));
  await page.route('**/api/jobs', (r) => r.fulfill(json([])));
  await page.route('**/api/jobs/today', (r) => r.fulfill(json([])));
  await page.route('**/api/team/members', (r) => r.fulfill(json([])));
  await page.route('**/api/dashboard/**', (r) => r.fulfill(json({})));
  await page.route('**/api/bi/**', (r) => r.fulfill(json({ actions: [], sections: {}, summary: {} })));
  await page.route('**/api/activity-feed**', (r) => r.fulfill(json([])));
  await page.route('**/api/ops/**', (r) =>
    r.fulfill(json({ conflictCount: 0, overdueJobs: 0, unassignedJobs: 0, overCapacityWorkers: 0, overdueInvoices: 0, conflicts: [] }))
  );
}

/**
 * Navigate to the dashboard root and wait until the main panel is mounted.
 * The widget loading skeleton will have resolved by the time we assert.
 */
async function gotoDashboard(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-testid="owner-manager-dashboard"]')).toBeVisible({ timeout: 15000 });
  // Wait for the loading skeleton to disappear before asserting widget state
  await expect(page.locator('[data-testid="unassigned-phases-widget-loading"]')).not.toBeVisible({ timeout: 10000 });
}

test.describe('UnassignedPhasesWidget on the dashboard', () => {
  test('widget is absent from the DOM when there are no unassigned phases', async ({ page }) => {
    await mockDashboardApis(page);
    await page.route('**/api/phases/unassigned', (r) =>
      r.fulfill(json({ phases: [] }))
    );

    await gotoDashboard(page);

    await expect(page.locator('[data-testid="unassigned-phases-widget"]')).not.toBeVisible();
  });

  test('shows Urgent badge on the dashboard widget for a phase starting within 24 hours', async ({ page }) => {
    await mockDashboardApis(page);
    const phase = makePhase({ id: 'dash-phase-1', scheduledStart: isoOffset(24 * H) });
    await page.route('**/api/phases/unassigned', (r) =>
      r.fulfill(json({ phases: [phase] }))
    );

    await gotoDashboard(page);

    await expect(page.locator('[data-testid="unassigned-phases-widget"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="badge-urgent-dash-phase-1"]')).toBeVisible();
  });

  test('shows Overdue badge on the dashboard widget for a phase whose start date has passed', async ({ page }) => {
    await mockDashboardApis(page);
    const phase = makePhase({ id: 'dash-phase-2', scheduledStart: isoOffset(-2 * 24 * H) });
    await page.route('**/api/phases/unassigned', (r) =>
      r.fulfill(json({ phases: [phase] }))
    );

    await gotoDashboard(page);

    await expect(page.locator('[data-testid="unassigned-phases-widget"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="badge-overdue-dash-phase-2"]')).toBeVisible();
  });

  test('does not show "View All" button when there are exactly 5 unassigned phases', async ({ page }) => {
    await mockDashboardApis(page);
    const phases = Array.from({ length: 5 }, (_, i) =>
      makePhase({ id: `dash-phase-${i + 1}`, jobId: `job-${i + 1}`, name: `Phase ${i + 1}` })
    );
    await page.route('**/api/phases/unassigned', (r) =>
      r.fulfill(json({ phases }))
    );

    await gotoDashboard(page);

    await expect(page.locator('[data-testid="unassigned-phases-widget"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="button-view-all-unassigned"]')).not.toBeVisible();
  });

  test('shows "View All" button and navigates to /phases/unassigned when there are 6 unassigned phases', async ({ page }) => {
    await mockDashboardApis(page);
    const phases = Array.from({ length: 6 }, (_, i) =>
      makePhase({ id: `dash-phase-${i + 1}`, jobId: `job-${i + 1}`, name: `Phase ${i + 1}` })
    );
    await page.route('**/api/phases/unassigned', (r) =>
      r.fulfill(json({ phases }))
    );

    await gotoDashboard(page);

    await expect(page.locator('[data-testid="unassigned-phases-widget"]')).toBeVisible({ timeout: 10000 });
    const viewAllBtn = page.locator('[data-testid="button-view-all-unassigned"]');
    await expect(viewAllBtn).toBeVisible({ timeout: 10000 });
    await viewAllBtn.click();
    await expect(page).toHaveURL(/\/phases\/unassigned/, { timeout: 10000 });
  });
});

test('search filters phase rows by phase name', async ({ page }) => {
  await mockBaseApis(page);
  const phases = [
    makePhase({ id: 'p1', name: 'Foundation', jobTitle: 'Build A', scheduledStart: isoOffset(5 * 24 * H) }),
    makePhase({ id: 'p2', name: 'Electrical', jobTitle: 'Build B', scheduledStart: isoOffset(6 * 24 * H) }),
  ];
  await page.route('**/api/phases/unassigned', (r) =>
    r.fulfill(json({ phases, teamMembers: [] }))
  );

  await gotoUnassignedPage(page);

  await expect(page.locator('[data-testid="unassigned-phase-row-p1"]')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-testid="unassigned-phase-row-p2"]')).toBeVisible();

  await page.locator('[data-testid="unassigned-phases-search"]').fill('electrical');

  await expect(page.locator('[data-testid="unassigned-phase-row-p1"]')).not.toBeVisible();
  await expect(page.locator('[data-testid="unassigned-phase-row-p2"]')).toBeVisible();
});
