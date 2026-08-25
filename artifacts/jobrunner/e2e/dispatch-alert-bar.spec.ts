import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Shared mock fixtures  (mirrors dispatch-skeleton.spec.ts)
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

/**
 * Register mocks for every endpoint the App shell + DispatchBoard needs.
 * Individual tests register overrides AFTER this call — Playwright LIFO wins.
 */
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

  // Healthy by default — tests that need issues override below.
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
// Helper: make today's ISO date string for board job fixtures
// ---------------------------------------------------------------------------
function todayIso() {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Test 1 — Alert bar is hidden when all ops-health counts are zero
// ---------------------------------------------------------------------------

test('ops alert bar is hidden when all health counts are zero', async ({ page }) => {
  await mockBaseApis(page);
  // Default mock already returns OPS_HEALTH_OK (all zeros) and no aging jobs.

  await page.goto('/dispatch', { waitUntil: 'networkidle' });

  const board = page.locator('[data-testid="dispatch-board"]');
  await expect(board).toBeVisible({ timeout: 10000 });

  // The alert bar should not be present when there is nothing to report.
  await expect(page.getByText('Ops Alert')).not.toBeVisible();
  await expect(page.getByText('Overdue')).not.toBeVisible();
  await expect(page.getByText('Unassigned')).not.toBeVisible();
  await expect(page.getByText('Over Capacity')).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 2 — Overdue chip count matches the board jobs
//
// The board has 2 today-scheduled jobs that are past their scheduled time
// and neither completed nor in_progress. /api/ops/health returns
// overdueJobs: 2 reflecting those same records.
// ---------------------------------------------------------------------------

test('overdue chip count matches overdue jobs on the board', async ({ page }) => {
  await mockBaseApis(page);

  const OVERDUE_JOBS = [
    {
      id: 'job-overdue-1',
      title: 'Fix Burst Pipe',
      status: 'scheduled',
      clientName: 'Alice Smith',
      address: '1 High St',
      scheduledAt: todayIso(),
      scheduledTime: '08:00',
      assignedTo: 'w1',
      jobType: 'service',
      estimatedDuration: 60,
      assignments: [{ memberId: 'w1' }],
    },
    {
      id: 'job-overdue-2',
      title: 'Roof Inspection',
      status: 'scheduled',
      clientName: 'Bob Jones',
      address: '2 Low Rd',
      scheduledAt: todayIso(),
      scheduledTime: '09:00',
      assignedTo: 'w1',
      jobType: 'service',
      estimatedDuration: 60,
      assignments: [{ memberId: 'w1' }],
    },
  ];

  // Board returns these 2 overdue jobs.
  await page.route('**/api/dispatch/board', (r) => r.fulfill(json(OVERDUE_JOBS)));

  // Health endpoint reports the same count.
  await page.route('**/api/ops/health', (r) =>
    r.fulfill(
      json({
        ...OPS_HEALTH_OK,
        overdueJobs: 2,
      })
    )
  );

  await page.goto('/dispatch', { waitUntil: 'networkidle' });

  const board = page.locator('[data-testid="dispatch-board"]');
  await expect(board).toBeVisible({ timeout: 10000 });

  // The alert bar must be visible with a "2 Overdue" chip.
  // Overdue jobs are time-slotted in the day-view timeline grid so we verify
  // the chip count from the health endpoint rather than DOM text location.
  await expect(page.getByText('Ops Alert')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('2 Overdue')).toBeVisible({ timeout: 8000 });
});

// ---------------------------------------------------------------------------
// Test 3 — Unassigned chip count matches the board jobs
//
// The board has 3 pending jobs with no assignedTo. /api/ops/health returns
// unassignedJobs: 3 for the same records.
// ---------------------------------------------------------------------------

test('unassigned chip count matches unassigned jobs on the board', async ({ page }) => {
  await mockBaseApis(page);

  const UNASSIGNED_JOBS = [
    {
      id: 'job-unassigned-1',
      title: 'Install AC Unit',
      status: 'pending',
      clientName: 'Carol Lee',
      address: '3 Elm St',
      scheduledAt: null,
      scheduledTime: null,
      assignedTo: null,
      jobType: 'service',
      estimatedDuration: 90,
      assignments: [],
    },
    {
      id: 'job-unassigned-2',
      title: 'Electrical Inspection',
      status: 'pending',
      clientName: 'Dan Brown',
      address: '4 Oak Ave',
      scheduledAt: null,
      scheduledTime: null,
      assignedTo: null,
      jobType: 'service',
      estimatedDuration: 60,
      assignments: [],
    },
    {
      id: 'job-unassigned-3',
      title: 'Plumbing Repair',
      status: 'pending',
      clientName: 'Eve White',
      address: '5 Pine Ln',
      scheduledAt: null,
      scheduledTime: null,
      assignedTo: null,
      jobType: 'service',
      estimatedDuration: 45,
      assignments: [],
    },
  ];

  await page.route('**/api/dispatch/board', (r) => r.fulfill(json(UNASSIGNED_JOBS)));
  await page.route('**/api/ops/health', (r) =>
    r.fulfill(
      json({
        ...OPS_HEALTH_OK,
        unassignedJobs: 3,
      })
    )
  );

  await page.goto('/dispatch', { waitUntil: 'networkidle' });

  const board = page.locator('[data-testid="dispatch-board"]');
  await expect(board).toBeVisible({ timeout: 10000 });

  // "3 Unassigned" chip must appear in the alert bar.
  await expect(page.getByText('Ops Alert')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('3 Unassigned')).toBeVisible({ timeout: 8000 });

  // All three unassigned jobs must be visible on the board.
  await expect(page.getByText('Install AC Unit')).toBeVisible({ timeout: 8000 });
  await expect(page.getByText('Electrical Inspection')).toBeVisible({ timeout: 8000 });
  await expect(page.getByText('Plumbing Repair')).toBeVisible({ timeout: 8000 });
});

// ---------------------------------------------------------------------------
// Test 4 — Over Capacity chip appears when a worker has too many jobs
// ---------------------------------------------------------------------------

test('over-capacity chip appears when a worker is over capacity', async ({ page }) => {
  await mockBaseApis(page);

  const WORKER = {
    id: 'w-cap',
    memberId: 'w-cap',
    userId: 'u-cap',
    firstName: 'Max',
    lastName: 'Worker',
    role: 'worker',
  };

  // Five 60-min jobs for one worker = 300 min; threshold is 480 min for 8 hours.
  // We only need health to report overCapacityWorkers: 1 — the board shows the jobs.
  const CAPACITY_JOBS = Array.from({ length: 5 }, (_, i) => ({
    id: `job-cap-${i}`,
    title: `Capacity Job ${i + 1}`,
    status: 'scheduled',
    clientName: 'Client X',
    address: `${i + 1} Work St`,
    scheduledAt: todayIso(),
    scheduledTime: `0${8 + i}:00`,
    assignedTo: 'w-cap',
    jobType: 'service',
    estimatedDuration: 60,
    assignments: [{ memberId: 'w-cap' }],
  }));

  await page.route('**/api/dispatch/board', (r) => r.fulfill(json(CAPACITY_JOBS)));
  await page.route('**/api/team/members', (r) => r.fulfill(json([WORKER])));
  await page.route('**/api/ops/health', (r) =>
    r.fulfill(
      json({
        ...OPS_HEALTH_OK,
        overCapacityWorkers: 1,
      })
    )
  );

  await page.goto('/dispatch', { waitUntil: 'networkidle' });

  const board = page.locator('[data-testid="dispatch-board"]');
  await expect(board).toBeVisible({ timeout: 10000 });

  await expect(page.getByText('Ops Alert')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('1 Over Capacity')).toBeVisible({ timeout: 8000 });

  // At least the first job for that worker should appear on the board.
  await expect(page.getByText('Capacity Job 1')).toBeVisible({ timeout: 8000 });
});

// ---------------------------------------------------------------------------
// Test 5 — Stale chip count comes from /api/ops/job-aging
// ---------------------------------------------------------------------------

test('stale chip count matches job-aging data', async ({ page }) => {
  await mockBaseApis(page);

  const AGING_JOBS = [
    {
      id: 'job-aging-1',
      title: 'Quote Pending Forever',
      status: 'quoted',
      clientName: 'Old Client',
      daysInStatus: 10,
      threshold: 7,
      daysOverThreshold: 3,
      severity: 'warning',
      updatedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
      scheduledAt: null,
    },
    {
      id: 'job-aging-2',
      title: 'Stalled Project',
      status: 'in_progress',
      clientName: 'Stale Corp',
      daysInStatus: 30,
      threshold: 14,
      daysOverThreshold: 16,
      severity: 'critical',
      updatedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      scheduledAt: null,
    },
  ];

  // Board includes those same jobs.
  await page.route('**/api/dispatch/board', (r) =>
    r.fulfill(
      json(
        AGING_JOBS.map((j) => ({
          id: j.id,
          title: j.title,
          status: j.status,
          clientName: j.clientName,
          address: '1 Test Rd',
          scheduledAt: j.scheduledAt,
          scheduledTime: null,
          assignedTo: null,
          jobType: 'service',
          estimatedDuration: 60,
          assignments: [],
        }))
      )
    )
  );

  await page.route('**/api/ops/job-aging', (r) =>
    r.fulfill(
      json({
        totalAging: 2,
        criticalCount: 1,
        agingJobs: AGING_JOBS,
      })
    )
  );

  // Health shows no other issues.
  await page.route('**/api/ops/health', (r) => r.fulfill(json(OPS_HEALTH_OK)));

  await page.goto('/dispatch', { waitUntil: 'networkidle' });

  const board = page.locator('[data-testid="dispatch-board"]');
  await expect(board).toBeVisible({ timeout: 10000 });

  // The "2 Stale" chip from job-aging must be visible.
  await expect(page.getByText('Ops Alert')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('2 Stale')).toBeVisible({ timeout: 8000 });
});

// ---------------------------------------------------------------------------
// Test 6 — Multiple chips shown simultaneously
// ---------------------------------------------------------------------------

test('multiple alert chips are shown at once when several issues exist', async ({ page }) => {
  await mockBaseApis(page);

  await page.route('**/api/ops/health', (r) =>
    r.fulfill(
      json({
        conflictCount: 0,
        overdueJobs: 1,
        unassignedJobs: 2,
        overCapacityWorkers: 1,
        overdueInvoices: 3,
        conflicts: [],
      })
    )
  );

  await page.goto('/dispatch', { waitUntil: 'networkidle' });

  const board = page.locator('[data-testid="dispatch-board"]');
  await expect(board).toBeVisible({ timeout: 10000 });

  // All four chips must appear in the same bar.
  await expect(page.getByText('Ops Alert')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('1 Overdue')).toBeVisible({ timeout: 8000 });
  await expect(page.getByText('2 Unassigned')).toBeVisible({ timeout: 8000 });
  await expect(page.getByText('1 Over Capacity')).toBeVisible({ timeout: 8000 });
  await expect(page.getByText('3 Overdue Invoices')).toBeVisible({ timeout: 8000 });
});

// ---------------------------------------------------------------------------
// Test 7 — Clicking the alert bar does not crash (toggles expansion)
// ---------------------------------------------------------------------------

test('clicking the alert bar toggles the expanded detail panel without error', async ({ page }) => {
  await mockBaseApis(page);

  const CONFLICT_MEMBER = {
    memberId: 'm1',
    memberName: 'Tom Builder',
    jobs: [
      { id: 'cj1', title: 'Morning Job', time: '08:00' },
      { id: 'cj2', title: 'Early Job',   time: '08:30' },
    ],
  };

  await page.route('**/api/ops/health', (r) =>
    r.fulfill(
      json({
        conflictCount: 2,
        overdueJobs: 0,
        unassignedJobs: 0,
        overCapacityWorkers: 0,
        overdueInvoices: 0,
        conflicts: [CONFLICT_MEMBER],
      })
    )
  );

  // Capture any uncaught page errors.
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto('/dispatch', { waitUntil: 'networkidle' });

  const board = page.locator('[data-testid="dispatch-board"]');
  await expect(board).toBeVisible({ timeout: 10000 });

  // The bar must show "2 Conflicts" chip (critical severity).
  const opsAlert = page.getByText('Ops Alert');
  await expect(opsAlert).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('2 Conflicts')).toBeVisible({ timeout: 8000 });

  // Click the bar — the chevron rotates and the conflict detail expands.
  await opsAlert.click();

  // The expanded detail lists the conflict: "Tom Builder has overlapping jobs"
  await expect(page.getByText('Tom Builder')).toBeVisible({ timeout: 5000 });
  await expect(page.getByText(/has overlapping jobs/i)).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('Morning Job')).toBeVisible({ timeout: 5000 });

  // Click again — the detail collapses.
  await opsAlert.click();
  await expect(page.getByText(/has overlapping jobs/i)).not.toBeVisible({ timeout: 5000 });

  // No JS errors during any of the above interactions.
  expect(pageErrors).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// Test 8 — Clicking individual chips does not crash
//
// Chips are inside the clickable bar row; clicking any chip simply toggles
// the same expansion (filter wiring is a future feature). Verify no crash.
// ---------------------------------------------------------------------------

test('clicking an individual chip does not crash the page', async ({ page }) => {
  await mockBaseApis(page);

  await page.route('**/api/ops/health', (r) =>
    r.fulfill(
      json({
        ...OPS_HEALTH_OK,
        unassignedJobs: 4,
      })
    )
  );

  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto('/dispatch', { waitUntil: 'networkidle' });

  const board = page.locator('[data-testid="dispatch-board"]');
  await expect(board).toBeVisible({ timeout: 10000 });

  // Locate the chip by its text and click it directly.
  const chip = page.getByText('4 Unassigned');
  await expect(chip).toBeVisible({ timeout: 10000 });
  await chip.click();

  // The board must still be visible — no navigation or crash.
  await expect(board).toBeVisible({ timeout: 5000 });
  expect(pageErrors).toHaveLength(0);
});
