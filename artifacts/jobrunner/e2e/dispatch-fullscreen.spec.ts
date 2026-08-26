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
 * Individual tests may register overrides AFTER this call — Playwright LIFO wins.
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
// Helpers
// ---------------------------------------------------------------------------

/** The desktop sidebar — matched by the same selector used in the CSS rule. */
const sidebarLocator = (page: Page) =>
  page.locator('[data-slot="sidebar"]:not([data-mobile="true"])').first();

/** Navigate to /dispatch and wait for the board container to appear. */
async function gotoDispatch(page: Page) {
  await page.goto('/dispatch', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-testid="dispatch-board"]')).toBeVisible({ timeout: 10000 });
}

// ---------------------------------------------------------------------------
// Test 1 — Full-screen button click hides the sidebar
// ---------------------------------------------------------------------------

test('full-screen button click adds dispatch-fullscreen class and hides the sidebar', async ({ page }) => {
  await mockBaseApis(page);
  await gotoDispatch(page);

  // The sidebar must be visible in normal mode.
  const sidebar = sidebarLocator(page);
  await expect(sidebar).toBeVisible({ timeout: 8000 });

  // The body class must not be set yet.
  const hasClassBefore = await page.evaluate(() =>
    document.body.classList.contains('dispatch-fullscreen')
  );
  expect(hasClassBefore).toBe(false);

  // Click the full-screen toggle button.
  const fullScreenBtn = page.getByRole('button', { name: /full screen/i });
  await expect(fullScreenBtn).toBeVisible({ timeout: 5000 });
  await fullScreenBtn.click();

  // The body class must now be present.
  await expect.poll(
    () => page.evaluate(() => document.body.classList.contains('dispatch-fullscreen')),
    { timeout: 5000 }
  ).toBe(true);

  // The sidebar must be hidden by the CSS rule.
  await expect(sidebar).not.toBeVisible({ timeout: 5000 });
});

// ---------------------------------------------------------------------------
// Test 2 — Full-screen button click a second time restores the sidebar
// ---------------------------------------------------------------------------

test('full-screen button click again removes dispatch-fullscreen class and shows the sidebar', async ({ page }) => {
  await mockBaseApis(page);
  await gotoDispatch(page);

  const sidebar = sidebarLocator(page);

  // Enter full-screen.
  await page.getByRole('button', { name: /full screen/i }).click();
  await expect.poll(
    () => page.evaluate(() => document.body.classList.contains('dispatch-fullscreen')),
    { timeout: 5000 }
  ).toBe(true);
  await expect(sidebar).not.toBeVisible({ timeout: 5000 });

  // Exit full-screen via the same button (title changes to "Exit full screen (F)").
  const exitBtn = page.getByRole('button', { name: /exit full screen/i });
  await expect(exitBtn).toBeVisible({ timeout: 5000 });
  await exitBtn.click();

  // The body class must be removed.
  await expect.poll(
    () => page.evaluate(() => document.body.classList.contains('dispatch-fullscreen')),
    { timeout: 5000 }
  ).toBe(false);

  // The sidebar must be visible again.
  await expect(sidebar).toBeVisible({ timeout: 5000 });
});

// ---------------------------------------------------------------------------
// Test 3 — Navigating away from /dispatch removes dispatch-fullscreen class
// ---------------------------------------------------------------------------

test('navigating away from /dispatch removes the dispatch-fullscreen body class', async ({ page }) => {
  await mockBaseApis(page);
  // Mock the jobs page endpoint so the navigation can settle.
  await page.route('**/api/jobs**', (r) => r.fulfill(json([])));

  await gotoDispatch(page);

  // Enter full-screen.
  await page.getByRole('button', { name: /full screen/i }).click();
  await expect.poll(
    () => page.evaluate(() => document.body.classList.contains('dispatch-fullscreen')),
    { timeout: 5000 }
  ).toBe(true);

  // Navigate to a different route in the SPA; this unmounts AdvancedDispatch.
  await page.goto('/jobs', { waitUntil: 'domcontentloaded' });

  // The cleanup in the useEffect must have removed the class.
  await expect.poll(
    () => page.evaluate(() => document.body.classList.contains('dispatch-fullscreen')),
    { timeout: 5000 }
  ).toBe(false);
});

// ---------------------------------------------------------------------------
// Test 4 — F key shortcut enters full-screen and hides the sidebar
// ---------------------------------------------------------------------------

test('pressing F enters full-screen and hides the sidebar', async ({ page }) => {
  await mockBaseApis(page);
  await gotoDispatch(page);

  const sidebar = sidebarLocator(page);
  await expect(sidebar).toBeVisible({ timeout: 8000 });

  // Press F while focused on the board (not an input).
  await page.locator('[data-testid="dispatch-board"]').press('f');

  // The class must be applied.
  await expect.poll(
    () => page.evaluate(() => document.body.classList.contains('dispatch-fullscreen')),
    { timeout: 5000 }
  ).toBe(true);

  // The sidebar must be hidden.
  await expect(sidebar).not.toBeVisible({ timeout: 5000 });
});

// ---------------------------------------------------------------------------
// Test 5 — F key shortcut toggles full-screen off
// ---------------------------------------------------------------------------

test('pressing F again exits full-screen and shows the sidebar', async ({ page }) => {
  await mockBaseApis(page);
  await gotoDispatch(page);

  const sidebar = sidebarLocator(page);
  const board = page.locator('[data-testid="dispatch-board"]');

  // Press F to enter full-screen.
  await board.press('f');
  await expect.poll(
    () => page.evaluate(() => document.body.classList.contains('dispatch-fullscreen')),
    { timeout: 5000 }
  ).toBe(true);
  await expect(sidebar).not.toBeVisible({ timeout: 5000 });

  // Press F again to exit full-screen.
  await board.press('f');
  await expect.poll(
    () => page.evaluate(() => document.body.classList.contains('dispatch-fullscreen')),
    { timeout: 5000 }
  ).toBe(false);
  await expect(sidebar).toBeVisible({ timeout: 5000 });
});
