import { test, expect, type Page, type Route } from '@playwright/test';

// ---------------------------------------------------------------------------
// Shared mock fixtures
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
 * Individual tests may register overrides AFTER this call — Playwright
 * uses LIFO ordering, so the last-registered handler for a URL wins.
 */
async function mockBaseApis(page: Page) {
  // Auth / session
  await page.route('**/api/auth/me', (r) => r.fulfill(json(AUTH_USER)));
  await page.route('**/api/auth/my-businesses', (r) =>
    r.fulfill(json([{ id: 1, name: 'Test Business' }]))
  );
  await page.route('**/api/team/my-role', (r) => r.fulfill({ status: 404, body: '' }));

  // Core settings
  await page.route('**/api/business-settings', (r) => r.fulfill(json(BUSINESS_SETTINGS)));
  await page.route('**/api/subscription/usage', (r) => r.fulfill(json(SUBSCRIPTION_USAGE)));

  // Dispatch board — default: immediate empty list
  await page.route('**/api/dispatch/board', (r) => r.fulfill(json([])));
  await page.route('**/api/dispatch/resources', (r) =>
    r.fulfill(json({ teamMembers: [], vehicles: [] }))
  );

  // Ops health — default: healthy (no issues)
  await page.route('**/api/ops/health', (r) => r.fulfill(json(OPS_HEALTH_OK)));
  await page.route('**/api/ops/job-aging', (r) =>
    r.fulfill(json({ totalAging: 0, criticalCount: 0, agingJobs: [] }))
  );

  // Supporting dispatch data
  await page.route('**/api/jobs', (r) => r.fulfill(json([])));
  await page.route('**/api/clients', (r) => r.fulfill(json([])));
  await page.route('**/api/team/members', (r) => r.fulfill(json([])));
  await page.route('**/api/team/worker-states', (r) => r.fulfill(json([])));
  await page.route('**/api/ai/schedule-suggestions**', (r) =>
    r.fulfill(json({ suggestions: [] }))
  );

  // Misc endpoints the App shell fires on mount
  await page.route('**/api/notifications/**', (r) =>
    r.fulfill(json({ notifications: [], unreadCount: 0 }))
  );
  await page.route('**/api/integrations/health', (r) =>
    r.fulfill(json({ allReady: true }))
  );
}

// ---------------------------------------------------------------------------
// Test 1 — Board skeleton while /api/dispatch/board is delayed
// ---------------------------------------------------------------------------

test('shows board skeleton while /api/dispatch/board is loading', async ({ page }) => {
  await mockBaseApis(page);

  // Hold the board response so the loading state stays visible long enough to assert.
  let resolveBoard!: () => void;
  const boardHeld = new Promise<void>((res) => { resolveBoard = res; });

  await page.route('**/api/dispatch/board', async (route: Route) => {
    await boardHeld;
    await route.fulfill(json([]));
  });

  // /dispatch-board now redirects to the unified /dispatch page.
  await page.goto('/dispatch', { waitUntil: 'domcontentloaded' });

  // The unified Dispatch page container must be visible.
  const dispatchBoard = page.locator('[data-testid="dispatch-board"]');
  await expect(dispatchBoard).toBeVisible({ timeout: 10000 });

  // While the board request is held, a loading spinner is shown.
  const loadingSpinner = page.locator('[data-testid="dispatch-loading"]');
  await expect(loadingSpinner).toBeVisible({ timeout: 8000 });

  // Release the held request and verify the spinner disappears.
  resolveBoard();
  await expect(loadingSpinner).not.toBeVisible({ timeout: 10000 });
});

// ---------------------------------------------------------------------------
// Test 2 — Map skeleton while /api/dispatch/board is delayed
// ---------------------------------------------------------------------------

test('kanban view renders job columns after board data loads', async ({ page }) => {
  // The old DispatchBoard had a Map tab with its own skeleton. The unified /dispatch
  // page does not have a map tab (map is a separate feature). This test replaces the
  // map-skeleton assertion with a sanity check that Kanban view renders correctly.
  await mockBaseApis(page);

  await page.goto('/dispatch', { waitUntil: 'networkidle' });

  const dispatchBoard = page.locator('[data-testid="dispatch-board"]');
  await expect(dispatchBoard).toBeVisible({ timeout: 10000 });

  // Switch to Kanban view.
  const kanbanBtn = dispatchBoard.getByRole('button', { name: /^kanban$/i });
  await expect(kanbanBtn).toBeVisible({ timeout: 5000 });
  await kanbanBtn.click();

  // Kanban renders status columns. At least the "Assigned" column should appear.
  await expect(dispatchBoard.getByText('Assigned')).toBeVisible({ timeout: 8000 });
});

// ---------------------------------------------------------------------------
// Test 3 — Deleted template absent from job-creation picker without reload
// ---------------------------------------------------------------------------

test('deleted template is absent from job-creation picker without page reload', async ({ page }) => {
  await mockBaseApis(page);

  const TEMPLATE = {
    id: 'tpl-del-test',
    name: 'House Build',
    description: 'Standard house build template',
    templateData: {
      phases: [
        { phaseCode: 'FOUND', name: 'Foundation' },
        { phaseCode: 'FRAME', name: 'Framing' },
      ],
      checklistItems: [],
    },
    createdAt: new Date().toISOString(),
  };

  // Stateful flag: starts false, flipped to true to simulate deletion.
  // The mock returns the template before deletion and an empty list after.
  let deleted = false;
  await page.route('**/api/project-templates', (route) => {
    route.fulfill(json(deleted ? [] : [TEMPLATE]));
  });

  // Navigate to the job creation form.
  await page.goto('/jobs/new', { waitUntil: 'networkidle' });

  // The job type picker must be visible.
  const typePicker = page.locator('[data-testid="page-job-type-picker"]');
  await expect(typePicker).toBeVisible({ timeout: 10000 });

  // Select "Project" — this enables the /api/project-templates query.
  await page.click('[data-testid="card-job-type-project"]');

  // Template picker renders and the saved template is shown.
  const templatePicker = page.locator('[data-testid="page-template-picker"]');
  await expect(templatePicker).toBeVisible({ timeout: 10000 });

  const templateBtn = page.locator('[data-testid="button-use-template-tpl-del-test"]');
  await expect(templateBtn).toBeVisible({ timeout: 5000 });

  // Simulate what ProjectTemplatesSettings' delete mutation does:
  //   1. Switch the mock so the next GET /api/project-templates returns [].
  //   2. Call queryClient.invalidateQueries with the same key used by onSuccess —
  //      this is the exact mechanism that keeps the picker in sync after deletion.
  // No page reload is involved: queryClient lives in the same document.
  deleted = true;
  await page.evaluate(async () => {
    // __testQueryClient is exposed by main.tsx in DEV mode.
    const qc = (window as any).__testQueryClient;
    if (!qc) throw new Error('__testQueryClient not found on window');
    await qc.invalidateQueries({ queryKey: ['/api/project-templates'] });
  });

  // After the invalidation-triggered refetch the deleted template must be gone.
  await expect(templateBtn).not.toBeVisible({ timeout: 10000 });

  // The "Start blank" fallback must still be available.
  await expect(page.locator('[data-testid="button-skip-template"]')).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 4 — Newly created template appears in job-creation picker without reload
// ---------------------------------------------------------------------------

test('newly created template appears in job-creation picker without page reload', async ({ page }) => {
  await mockBaseApis(page);

  const TEMPLATE = {
    id: 'tpl-create-test',
    name: 'Renovation Build',
    description: 'Standard renovation template',
    templateData: {
      phases: [
        { phaseCode: 'DEMO', name: 'Demolition' },
        { phaseCode: 'FIT', name: 'Fit-out' },
      ],
      checklistItems: [],
    },
    createdAt: new Date().toISOString(),
  };

  // Stateful flag: starts false (no saved templates), flipped to true to simulate creation.
  let created = false;
  await page.route('**/api/project-templates', (route) => {
    route.fulfill(json(created ? [TEMPLATE] : []));
  });

  // Navigate to the job creation form.
  await page.goto('/jobs/new', { waitUntil: 'networkidle' });

  // The job type picker must be visible.
  const typePicker = page.locator('[data-testid="page-job-type-picker"]');
  await expect(typePicker).toBeVisible({ timeout: 10000 });

  // Select "Project" — this enables the /api/project-templates query.
  await page.click('[data-testid="card-job-type-project"]');

  // Template picker renders — no saved templates yet, so only "Start blank" is visible.
  const templatePicker = page.locator('[data-testid="page-template-picker"]');
  await expect(templatePicker).toBeVisible({ timeout: 10000 });

  const templateBtn = page.locator('[data-testid="button-use-template-tpl-create-test"]');
  await expect(templateBtn).not.toBeVisible();

  // Simulate what ProjectTemplatesSettings' POST mutation does in its onSuccess:
  //   1. Switch the mock so the next GET /api/project-templates returns the new template.
  //   2. Call queryClient.invalidateQueries with the same key used by onSuccess —
  //      this is the exact mechanism that keeps the picker in sync after creation.
  // No page reload is involved: queryClient lives in the same document.
  created = true;
  await page.evaluate(async () => {
    const qc = (window as any).__testQueryClient;
    if (!qc) throw new Error('__testQueryClient not found on window');
    await qc.invalidateQueries({ queryKey: ['/api/project-templates'] });
  });

  // After the invalidation-triggered refetch the new template must appear.
  await expect(templateBtn).toBeVisible({ timeout: 10000 });

  // The "Start blank" fallback must still be available.
  await expect(page.locator('[data-testid="button-skip-template"]')).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 5 — Template picker skeleton while /api/project-templates is delayed
// ---------------------------------------------------------------------------

test('shows template picker skeleton while /api/project-templates is loading', async ({ page }) => {
  await mockBaseApis(page);

  // Hold the project-templates response indefinitely so the skeleton stays visible.
  let resolveTemplates!: () => void;
  const templatesHeld = new Promise<void>((res) => { resolveTemplates = res; });

  await page.route('**/api/project-templates', async (route: Route) => {
    await templatesHeld;
    await route.fulfill(json([]));
  });

  await page.goto('/jobs/new', { waitUntil: 'networkidle' });

  // The job type picker must be visible first.
  const typePicker = page.locator('[data-testid="page-job-type-picker"]');
  await expect(typePicker).toBeVisible({ timeout: 10000 });

  // Click "Project" — this enables the /api/project-templates query.
  await page.click('[data-testid="card-job-type-project"]');

  // The template picker page renders.
  const templatePicker = page.locator('[data-testid="page-template-picker"]');
  await expect(templatePicker).toBeVisible({ timeout: 10000 });

  // While the request is held, the loading skeleton must be visible.
  const skeleton = page.locator('[data-testid="template-picker-skeleton"]');
  await expect(skeleton).toBeVisible({ timeout: 5000 });

  // Release the held request and verify the skeleton disappears.
  resolveTemplates();
  await expect(skeleton).not.toBeVisible({ timeout: 10000 });
});

// ---------------------------------------------------------------------------
// Test 6 — Template picker error state recovers after Retry
// ---------------------------------------------------------------------------

test('template picker error state recovers and shows templates after clicking Retry', async ({ page }) => {
  await mockBaseApis(page);

  const TEMPLATE = {
    id: 'tpl-retry-test',
    name: 'Retry Recovery Template',
    description: 'Template that appears after retry',
    templateData: {
      phases: [],
      checklist: [],
    },
  };

  // Track how many times /api/project-templates has been called.
  let callCount = 0;

  // The global queryClient retries 500s once automatically (failureCount 0→1,
  // then failureCount >= 1 stops it). So we need the first TWO calls to fail
  // before isError becomes true and the error state renders.
  // Third call (triggered by the user clicking Retry) succeeds.
  await page.route('**/api/project-templates', (route) => {
    callCount += 1;
    if (callCount <= 2) {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'server error' }),
      });
    } else {
      route.fulfill(json([TEMPLATE]));
    }
  });

  await page.goto('/jobs/new', { waitUntil: 'networkidle' });

  // The job type picker must be visible first.
  const typePicker = page.locator('[data-testid="page-job-type-picker"]');
  await expect(typePicker).toBeVisible({ timeout: 10000 });

  // Select "Project" — this triggers the /api/project-templates fetch.
  await page.click('[data-testid="card-job-type-project"]');

  // The template picker page renders.
  const templatePicker = page.locator('[data-testid="page-template-picker"]');
  await expect(templatePicker).toBeVisible({ timeout: 10000 });

  // The error state must be shown after the first (failing) fetch.
  const errorState = page.locator('[data-testid="template-picker-error"]');
  await expect(errorState).toBeVisible({ timeout: 10000 });

  // Click Retry — this triggers the second fetch which succeeds.
  await page.click('[data-testid="button-retry-templates"]');

  // The error state must disappear and the template card must appear.
  await expect(errorState).not.toBeVisible({ timeout: 10000 });
  const templateBtn = page.locator(`[data-testid="button-use-template-${TEMPLATE.id}"]`);
  await expect(templateBtn).toBeVisible({ timeout: 10000 });
});

// ---------------------------------------------------------------------------
// Test 7a — Unscheduled queue panel surfaces jobs with no scheduled time
// ---------------------------------------------------------------------------

test('unscheduled queue panel shows a job with no scheduledAt in day view', async ({ page }) => {
  await mockBaseApis(page);

  const UNSCHEDULED_JOB = {
    id: 'job-unscheduled-1',
    title: 'Fix Roof Leak',
    status: 'pending',
    clientName: 'Alice Smith',
    address: '12 Oak St',
    scheduledAt: null,
    scheduledTime: null,
    assignedTo: null,
    jobType: 'service',
    estimatedDuration: 60,
    assignments: [],
  };

  await page.route('**/api/dispatch/board', (r) => r.fulfill(json([UNSCHEDULED_JOB])));

  await page.goto('/dispatch', { waitUntil: 'networkidle' });

  const dispatchBoard = page.locator('[data-testid="dispatch-board"]');
  await expect(dispatchBoard).toBeVisible({ timeout: 10000 });

  // The unscheduled queue panel is always visible in day view.
  // The job card must surface the job title.
  await expect(page.getByText('Fix Roof Leak')).toBeVisible({ timeout: 8000 });
  // The "no time set" indicator must be present.
  await expect(page.getByText('No time set')).toBeVisible({ timeout: 5000 });
});

// ---------------------------------------------------------------------------
// Test 7b — Quick-assign dialog opens from the unscheduled queue
// ---------------------------------------------------------------------------

test('quick-assign dialog opens when Assign is clicked on an unscheduled job', async ({ page }) => {
  await mockBaseApis(page);

  const UNSCHEDULED_JOB = {
    id: 'job-assign-dialog-1',
    title: 'Install Hot Water System',
    status: 'pending',
    clientName: 'Bob Jones',
    address: '99 Pine Ave',
    scheduledAt: null,
    scheduledTime: null,
    assignedTo: null,
    jobType: 'service',
    estimatedDuration: 90,
    assignments: [],
  };

  const WORKER = {
    id: 'w1',
    memberId: 'w1',
    userId: 'w1',
    firstName: 'Jane',
    lastName: 'Doe',
    role: 'worker',
  };

  await page.route('**/api/dispatch/board', (r) => r.fulfill(json([UNSCHEDULED_JOB])));
  await page.route('**/api/team/members', (r) => r.fulfill(json([WORKER])));

  await page.goto('/dispatch', { waitUntil: 'networkidle' });

  // Wait for the job card to appear in the queue.
  await expect(page.getByText('Install Hot Water System')).toBeVisible({ timeout: 8000 });

  // Click the Assign button on the card.
  await page.getByRole('button', { name: /^assign$/i }).first().click();

  // The quick-assign dialog must open.
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
  // Dialog contains the job title.
  await expect(page.getByRole('dialog').getByText('Install Hot Water System')).toBeVisible({ timeout: 3000 });
});

// ---------------------------------------------------------------------------
// Test 7c — /dispatch-board?date=YYYY-MM-DD deep link initialises correct day
// ---------------------------------------------------------------------------

test('/dispatch-board?date= deep link initialises dispatch to the specified date', async ({ page }) => {
  await mockBaseApis(page);

  const TARGET_DATE = '2026-03-15'; // a known Saturday

  // Navigate via the retired /dispatch-board route with a date param.
  await page.goto(`/dispatch-board?date=${TARGET_DATE}`, { waitUntil: 'networkidle' });

  // Verify we landed on the unified /dispatch page.
  const dispatchBoard = page.locator('[data-testid="dispatch-board"]');
  await expect(dispatchBoard).toBeVisible({ timeout: 10000 });

  // The date in the top-bar navigation label must reflect the target date.
  // AdvancedDispatch renders the day view by default: "Saturday, 15 March 2026"
  await expect(page.getByText(/15 March 2026/)).toBeVisible({ timeout: 8000 });
});

// ---------------------------------------------------------------------------
// Test 7 — Ops health error banner on network failure
// ---------------------------------------------------------------------------

test('shows ops health error banner when /api/ops/health fails', async ({ page }) => {
  await mockBaseApis(page);

  // Override ops/health with a 500 response (registered last = wins via LIFO).
  // We use 500 rather than route.abort() because the app's getQueryFn catches
  // 'Failed to fetch' network errors and silently returns [] instead of throwing,
  // which prevents isError from being set. A 500 HTTP response is rethrown as
  // an Error("500: ...") that TanStack Query correctly marks as isError=true.
  await page.route('**/api/ops/health', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'server error' }) })
  );

  await page.goto('/dispatch', { waitUntil: 'networkidle' });

  // OpsHealthBanner renders this string when opsHealthError is true.
  const errorBanner = page.getByText('Ops health could not be loaded');
  await expect(errorBanner).toBeVisible({ timeout: 15000 });
});
