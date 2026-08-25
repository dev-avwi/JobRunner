import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Shared fixtures
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

const CLIENT = {
  id: 'client-1',
  name: 'Acme Corp',
  email: 'acme@example.com',
  phone: '0400000001',
};

/** Minimal service-call job fixture. Status is 'scheduled' so the stepper renders. */
const SERVICE_CALL_JOB = {
  id: 'sc-1',
  title: 'Fix Leaking Tap',
  status: 'scheduled',
  jobType: 'service_call',
  clientId: 'client-1',
  address: '1 Test St, Sydney NSW 2000',
  scheduledAt: new Date(Date.now() + 86400000).toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/** Minimal project job fixture. */
const PROJECT_JOB = {
  id: 'prj-1',
  title: 'Kitchen Renovation',
  status: 'in_progress',
  jobType: 'project',
  clientId: 'client-1',
  address: '2 Build Ave, Melbourne VIC 3000',
  scheduledAt: new Date(Date.now() + 172800000).toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const PHASES = [
  { id: 'ph-1', name: 'Demolition', phaseCode: 'DEMO', status: 'complete' },
  { id: 'ph-2', name: 'Fit-out', phaseCode: 'FIT', status: 'pending' },
  { id: 'ph-3', name: 'Painting', phaseCode: 'PAINT', status: 'pending' },
];

const EMPTY_LINKED_DOCS = {
  linkedQuote: null,
  linkedInvoice: null,
  linkedReceipts: [],
  quoteCount: 0,
  invoiceCount: 0,
  receiptCount: 0,
};

function json(body: unknown) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify(body) };
}

/**
 * Register mocks for every endpoint the App shell needs to boot.
 * Individual tests may register overrides AFTER this call; Playwright
 * uses LIFO ordering so the last-registered handler for a URL wins.
 */
async function mockBaseApis(page: Page) {
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
  await page.route('**/api/team/members', (r) => r.fulfill(json([])));
  await page.route('**/api/equipment', (r) => r.fulfill(json([])));
  // Broad time-entries catch-all; /active/current overridden below (LIFO)
  await page.route('**/api/time-entries**', (r) => r.fulfill(json([])));
  await page.route('**/api/time-entries/active/current', (r) => r.fulfill(json(null)));
  // Dispatch / ops endpoints the App shell may fire on navigation
  await page.route('**/api/dispatch/board', (r) => r.fulfill(json([])));
  await page.route('**/api/dispatch/resources', (r) =>
    r.fulfill(json({ teamMembers: [], vehicles: [] }))
  );
  await page.route('**/api/ops/health', (r) =>
    r.fulfill(json({ conflictCount: 0, overdueJobs: 0, unassignedJobs: 0, overCapacityWorkers: 0, overdueInvoices: 0, conflicts: [] }))
  );
  await page.route('**/api/ops/job-aging', (r) =>
    r.fulfill(json({ totalAging: 0, criticalCount: 0, agingJobs: [] }))
  );
  await page.route('**/api/ai/schedule-suggestions**', (r) =>
    r.fulfill(json({ suggestions: [] }))
  );
  // Jobs list used for worker-availability check (only when teamMembers > 0, so disabled
  // in tests, but register a fallback to avoid 404 noise)
  await page.route('**/api/jobs', (r) => r.fulfill(json([])));
}

/**
 * Register all endpoints a job detail page needs.
 * Call AFTER mockBaseApis so these more-specific handlers win (LIFO).
 */
async function mockJobDetailApis(
  page: Page,
  job: typeof SERVICE_CALL_JOB | typeof PROJECT_JOB,
  options: { phases?: typeof PHASES } = {}
) {
  const id = job.id;

  // Job detail
  await page.route(`**/api/jobs/${id}`, (r) => r.fulfill(json(job)));

  // Client
  await page.route(`**/api/clients/${job.clientId}`, (r) => r.fulfill(json(CLIENT)));

  // Explicit-queryFn subroutes (fetch() calls with full URL paths)
  await page.route(`**/api/jobs/${id}/linked-documents`, (r) =>
    r.fulfill(json(EMPTY_LINKED_DOCS))
  );
  await page.route(`**/api/jobs/${id}/assignments`, (r) => r.fulfill(json([])));
  await page.route(`**/api/jobs/${id}/activity**`, (r) => r.fulfill(json([])));

  // Default-queryFn subroutes (keyed, no explicit queryFn)
  await page.route(`**/api/jobs/${id}/materials`, (r) => r.fulfill(json([])));
  await page.route(`**/api/jobs/${id}/variations`, (r) => r.fulfill(json([])));
  await page.route(`**/api/jobs/${id}/profitability`, (r) =>
    r.fulfill(json({ profit: { isNegative: false, margin: 0 } }))
  );
  await page.route(`**/api/jobs/${id}/photos`, (r) => r.fulfill(json([])));
  await page.route(`**/api/jobs/${id}/notes`, (r) => r.fulfill(json([])));
  await page.route(`**/api/jobs/${id}/voice-notes`, (r) => r.fulfill(json([])));
  await page.route(`**/api/jobs/${id}/signatures`, (r) => r.fulfill(json([])));
  await page.route(`**/api/jobs/${id}/equipment`, (r) => r.fulfill(json([])));

  // Project-only endpoints
  await page.route(`**/api/jobs/${id}/phases`, (r) =>
    r.fulfill(json(options.phases ?? []))
  );
  await page.route(`**/api/jobs/${id}/defect-items`, (r) => r.fulfill(json([])));

  // Portal URL endpoint (optional; 404 is safe here)
  await page.route(`**/api/clients/${job.clientId}/portal-url`, (r) =>
    r.fulfill({ status: 404, body: '' })
  );
}

// ---------------------------------------------------------------------------
// Test 1 — Service call renders the correct tab strip (no Phases tab)
// ---------------------------------------------------------------------------

test('service call renders tab strip without a Phases tab', async ({ page }) => {
  await mockBaseApis(page);
  await mockJobDetailApis(page, SERVICE_CALL_JOB);

  await page.goto(`/jobs/${SERVICE_CALL_JOB.id}`, { waitUntil: 'networkidle' });

  const view = page.locator('[data-testid="job-detail-view"]');
  await expect(view).toBeVisible({ timeout: 15000 });

  const strip = page.locator('[data-testid="tab-strip"]');
  await expect(strip).toBeVisible({ timeout: 10000 });

  // Expected tabs
  for (const tab of ['tab-overview', 'tab-activity', 'tab-financials', 'tab-docs', 'tab-chat']) {
    await expect(page.locator(`[data-testid="${tab}"]`)).toBeVisible();
  }

  // Phases tab must NOT appear on a service call
  await expect(page.locator('[data-testid="tab-phases"]')).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 2 — Project renders the correct tab strip (includes Phases tab)
// ---------------------------------------------------------------------------

test('project renders tab strip with a Phases tab', async ({ page }) => {
  await mockBaseApis(page);
  await mockJobDetailApis(page, PROJECT_JOB, { phases: PHASES });

  await page.goto(`/jobs/${PROJECT_JOB.id}`, { waitUntil: 'networkidle' });

  const view = page.locator('[data-testid="job-detail-view"]');
  await expect(view).toBeVisible({ timeout: 15000 });

  const strip = page.locator('[data-testid="tab-strip"]');
  await expect(strip).toBeVisible({ timeout: 10000 });

  // All six tabs including Phases
  for (const tab of ['tab-overview', 'tab-phases', 'tab-activity', 'tab-financials', 'tab-docs', 'tab-chat']) {
    await expect(page.locator(`[data-testid="${tab}"]`)).toBeVisible();
  }
});

// ---------------------------------------------------------------------------
// Test 3 — ?tab=activity deep link activates the Activity tab
// ---------------------------------------------------------------------------

test('?tab=activity deep link lands on the Activity tab', async ({ page }) => {
  await mockBaseApis(page);
  await mockJobDetailApis(page, SERVICE_CALL_JOB);

  await page.goto(`/jobs/${SERVICE_CALL_JOB.id}?tab=activity`, { waitUntil: 'networkidle' });

  await expect(page.locator('[data-testid="job-detail-view"]')).toBeVisible({ timeout: 15000 });

  // Activity tab must be active; Overview must not
  await expect(page.locator('[data-testid="tab-activity"][data-state="active"]')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-testid="tab-overview"][data-state="active"]')).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 4 — ?tab=financials deep link activates the Financials tab
// ---------------------------------------------------------------------------

test('?tab=financials deep link lands on the Financials tab', async ({ page }) => {
  await mockBaseApis(page);
  await mockJobDetailApis(page, PROJECT_JOB, { phases: PHASES });

  await page.goto(`/jobs/${PROJECT_JOB.id}?tab=financials`, { waitUntil: 'networkidle' });

  await expect(page.locator('[data-testid="job-detail-view"]')).toBeVisible({ timeout: 15000 });

  await expect(page.locator('[data-testid="tab-financials"][data-state="active"]')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-testid="tab-overview"][data-state="active"]')).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 5 — ?tab=claims on a project maps to the Phases tab
// ---------------------------------------------------------------------------

test('?tab=claims on a project resolves to the Phases tab', async ({ page }) => {
  await mockBaseApis(page);
  await mockJobDetailApis(page, PROJECT_JOB, { phases: PHASES });

  await page.goto(`/jobs/${PROJECT_JOB.id}?tab=claims`, { waitUntil: 'networkidle' });

  await expect(page.locator('[data-testid="job-detail-view"]')).toBeVisible({ timeout: 15000 });

  // ?tab=claims → 'phases' for a project
  await expect(page.locator('[data-testid="tab-phases"][data-state="active"]')).toBeVisible({ timeout: 10000 });
});

// ---------------------------------------------------------------------------
// Test 6 — ?tab=claims on a service call falls back to Overview
// ---------------------------------------------------------------------------

test('?tab=claims on a service call falls back to the Overview tab', async ({ page }) => {
  await mockBaseApis(page);
  await mockJobDetailApis(page, SERVICE_CALL_JOB);

  await page.goto(`/jobs/${SERVICE_CALL_JOB.id}?tab=claims`, { waitUntil: 'networkidle' });

  await expect(page.locator('[data-testid="job-detail-view"]')).toBeVisible({ timeout: 15000 });

  // ?tab=claims on a service call → 'overview'
  await expect(page.locator('[data-testid="tab-overview"][data-state="active"]')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-testid="tab-phases"]')).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 7 — Status stepper appears for a service call
// ---------------------------------------------------------------------------

test('status stepper is visible for a scheduled service call', async ({ page }) => {
  await mockBaseApis(page);
  // SERVICE_CALL_JOB has status='scheduled' — stepper requires non-pending status
  await mockJobDetailApis(page, SERVICE_CALL_JOB);

  await page.goto(`/jobs/${SERVICE_CALL_JOB.id}`, { waitUntil: 'networkidle' });

  await expect(page.locator('[data-testid="job-detail-view"]')).toBeVisible({ timeout: 15000 });

  // The stepper renders when: isServiceCall && status !== 'pending' && !isTradie
  const stepper = page.locator('[data-testid="status-stepper"]');
  await expect(stepper).toBeVisible({ timeout: 10000 });

  // All four status steps must be present inside the stepper
  for (const label of ['Scheduled', 'In Progress', 'Complete', 'Invoiced']) {
    await expect(stepper.getByText(label)).toBeVisible();
  }
});

// ---------------------------------------------------------------------------
// Test 8 — Status stepper does NOT appear for a project
// ---------------------------------------------------------------------------

test('status stepper is not shown for a project', async ({ page }) => {
  await mockBaseApis(page);
  await mockJobDetailApis(page, PROJECT_JOB, { phases: PHASES });

  await page.goto(`/jobs/${PROJECT_JOB.id}`, { waitUntil: 'networkidle' });

  await expect(page.locator('[data-testid="job-detail-view"]')).toBeVisible({ timeout: 15000 });

  await expect(page.locator('[data-testid="status-stepper"]')).not.toBeVisible({ timeout: 5000 });
});

// ---------------------------------------------------------------------------
// Test 9 — Phase progress bar appears for a project with phases
// ---------------------------------------------------------------------------

test('phase progress bar is visible for a project that has phases', async ({ page }) => {
  await mockBaseApis(page);
  await mockJobDetailApis(page, PROJECT_JOB, { phases: PHASES });

  await page.goto(`/jobs/${PROJECT_JOB.id}`, { waitUntil: 'networkidle' });

  await expect(page.locator('[data-testid="job-detail-view"]')).toBeVisible({ timeout: 15000 });

  // Phase progress bar renders when isProject && phases.length > 0
  const progressBar = page.locator('[data-testid="phase-progress-bar"]');
  await expect(progressBar).toBeVisible({ timeout: 10000 });

  // PHASES has 1 complete out of 3 → shows completion text
  await expect(progressBar.getByText(/phase progress/i)).toBeVisible();
  await expect(progressBar.getByText(/1\s*\/\s*3/)).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 10 — Phase progress bar does NOT appear for a service call
// ---------------------------------------------------------------------------

test('phase progress bar is not shown for a service call', async ({ page }) => {
  await mockBaseApis(page);
  await mockJobDetailApis(page, SERVICE_CALL_JOB);

  await page.goto(`/jobs/${SERVICE_CALL_JOB.id}`, { waitUntil: 'networkidle' });

  await expect(page.locator('[data-testid="job-detail-view"]')).toBeVisible({ timeout: 15000 });

  await expect(page.locator('[data-testid="phase-progress-bar"]')).not.toBeVisible({ timeout: 5000 });
});

// ---------------------------------------------------------------------------
// Test 11 — Sidebar: client card, at-a-glance and quick links all visible
//            (service call)
// ---------------------------------------------------------------------------

test('sidebar client card, at-a-glance and quick links render for a service call', async ({ page }) => {
  await mockBaseApis(page);
  await mockJobDetailApis(page, SERVICE_CALL_JOB);

  await page.goto(`/jobs/${SERVICE_CALL_JOB.id}`, { waitUntil: 'networkidle' });

  await expect(page.locator('[data-testid="job-detail-view"]')).toBeVisible({ timeout: 15000 });

  // CLIENT fixture has name/email/phone; job fixture has address — client card renders
  await expect(page.locator('[data-testid="sidebar-client-card"]')).toBeVisible({ timeout: 10000 });

  // At a Glance is always rendered (no condition)
  await expect(page.locator('[data-testid="sidebar-at-a-glance"]')).toBeVisible({ timeout: 10000 });

  // Quick Links is rendered for non-tradie users (AUTH_USER is 'owner')
  await expect(page.locator('[data-testid="sidebar-quick-links"]')).toBeVisible({ timeout: 10000 });
});

// ---------------------------------------------------------------------------
// Test 12 — Sidebar sections persist when switching to a different tab
// ---------------------------------------------------------------------------

test('sidebar sections remain visible after switching to the Activity tab', async ({ page }) => {
  await mockBaseApis(page);
  await mockJobDetailApis(page, PROJECT_JOB, { phases: PHASES });

  await page.goto(`/jobs/${PROJECT_JOB.id}`, { waitUntil: 'networkidle' });

  await expect(page.locator('[data-testid="job-detail-view"]')).toBeVisible({ timeout: 15000 });

  // Switch to Activity tab
  await page.locator('[data-testid="tab-activity"]').click();
  await expect(page.locator('[data-testid="tab-activity"][data-state="active"]')).toBeVisible({ timeout: 5000 });

  // Sidebar must still be visible after the tab switch
  await expect(page.locator('[data-testid="sidebar-at-a-glance"]')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('[data-testid="sidebar-quick-links"]')).toBeVisible({ timeout: 5000 });
});
