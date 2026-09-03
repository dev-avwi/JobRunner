import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Shared fixtures (minimal — we only need the app shell to boot)
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

/** A small set of real articles so the home (no-search) state has results. */
const HELP_ARTICLES_RESPONSE = {
  categories: [
    { id: 'getting-started', label: 'Getting Started', icon: 'play' },
    { id: 'jobs', label: 'Jobs', icon: 'briefcase' },
  ],
  articles: [
    {
      id: 'art-1',
      category: 'getting-started',
      title: 'How to create your first job',
      summary: 'Learn how to create a job in JobRunner.',
      body: 'Step 1: Go to Jobs...',
    },
    {
      id: 'art-2',
      category: 'jobs',
      title: 'Managing job statuses',
      summary: 'Understand the lifecycle of a job.',
      body: 'Jobs move through several statuses...',
    },
  ],
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
  await page.route('**/api/notifications/**', (r) =>
    r.fulfill(json({ notifications: [], unreadCount: 0 }))
  );
  await page.route('**/api/integrations/health', (r) => r.fulfill(json({ allReady: true })));
  await page.route('**/api/team/members', (r) => r.fulfill(json([])));
  await page.route('**/api/equipment', (r) => r.fulfill(json([])));
  await page.route('**/api/time-entries**', (r) => r.fulfill(json([])));
  await page.route('**/api/time-entries/active/current', (r) => r.fulfill(json(null)));
  await page.route('**/api/dispatch/board', (r) => r.fulfill(json([])));
  await page.route('**/api/dispatch/resources', (r) =>
    r.fulfill(json({ teamMembers: [], vehicles: [] }))
  );
  await page.route('**/api/ops/health', (r) =>
    r.fulfill(
      json({
        conflictCount: 0,
        overdueJobs: 0,
        unassignedJobs: 0,
        overCapacityWorkers: 0,
        overdueInvoices: 0,
        conflicts: [],
      })
    )
  );
  await page.route('**/api/ops/job-aging', (r) =>
    r.fulfill(json({ totalAging: 0, criticalCount: 0, agingJobs: [] }))
  );
  await page.route('**/api/ai/schedule-suggestions**', (r) =>
    r.fulfill(json({ suggestions: [] }))
  );
  await page.route('**/api/jobs', (r) => r.fulfill(json([])));

  // Help Center articles
  await page.route('**/api/help/articles', (r) => r.fulfill(json(HELP_ARTICLES_RESPONSE)));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Help Center – Ask the Help Assistant button visibility', () => {
  test('button is absent on the home state (no search typed)', async ({ page }) => {
    await mockBaseApis(page);
    await page.goto('/', { waitUntil: 'networkidle' });

    // Open the Help Center panel
    await page.locator('[data-testid="button-help"]').click();
    await expect(page.locator('[data-testid="help-center-panel"]')).toBeVisible({
      timeout: 10000,
    });

    // Wait for articles to load (the list renders after the API responds)
    await expect(page.locator('[data-testid="help-search-input"]')).toBeVisible({
      timeout: 10000,
    });

    // The "Ask the Help Assistant" button must NOT be present in the home state
    await expect(page.locator('[data-testid="help-ask-assistant-btn"]')).not.toBeVisible();
  });

  test('button appears after a search that returns no results', async ({ page }) => {
    await mockBaseApis(page);
    await page.goto('/', { waitUntil: 'networkidle' });

    // Open the Help Center panel
    await page.locator('[data-testid="button-help"]').click();
    await expect(page.locator('[data-testid="help-center-panel"]')).toBeVisible({
      timeout: 10000,
    });

    // Wait for the search input to be ready
    const searchInput = page.locator('[data-testid="help-search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // Type a query that matches none of the seeded articles
    await searchInput.fill('xyzzy-no-match-12345');

    // The "Ask the Help Assistant" button must now be visible in the empty state
    await expect(page.locator('[data-testid="help-ask-assistant-btn"]')).toBeVisible({
      timeout: 5000,
    });
  });

  test('clicking the button switches to the chat tab with the query pre-filled', async ({
    page,
  }) => {
    await mockBaseApis(page);
    await page.goto('/', { waitUntil: 'networkidle' });

    // Open the Help Center panel
    await page.locator('[data-testid="button-help"]').click();
    await expect(page.locator('[data-testid="help-center-panel"]')).toBeVisible({
      timeout: 10000,
    });

    // Wait for the search input to be ready
    const searchInput = page.locator('[data-testid="help-search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    const searchQuery = 'xyzzy-no-match-12345';
    await searchInput.fill(searchQuery);

    // Wait for and click the "Ask the Help Assistant" button
    const assistantBtn = page.locator('[data-testid="help-ask-assistant-btn"]');
    await expect(assistantBtn).toBeVisible({ timeout: 5000 });
    await assistantBtn.click();

    // The chat tab must now be active
    const chatTab = page.locator('[data-testid="help-tab-chat"]');
    await expect(chatTab).toHaveClass(/bg-background/, { timeout: 5000 });

    // The chat input must be pre-filled with the search query
    const chatInput = page.locator('[data-testid="help-chat-input"]');
    await expect(chatInput).toBeVisible({ timeout: 5000 });
    await expect(chatInput).toHaveValue(searchQuery);
  });
});
