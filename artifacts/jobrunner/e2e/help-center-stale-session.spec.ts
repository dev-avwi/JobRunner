import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Fixtures
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
  await page.route('**/api/help/articles', (r) => r.fulfill(json(HELP_ARTICLES_RESPONSE)));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Open the Help Center panel and wait for it to be visible. */
async function openHelpCenter(page: Page) {
  await page.locator('[data-testid="button-help"]').click();
  await expect(page.locator('[data-testid="help-center-panel"]')).toBeVisible({ timeout: 10_000 });
}

/** Close the Help Center panel by pressing Escape. */
async function closeHelpCenter(page: Page) {
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid="help-center-panel"]')).not.toBeVisible({
    timeout: 5_000,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Help Center – stale session detection', () => {
  test('reopening on a different route clears the pre-fill query from a previous session', async ({
    page,
  }) => {
    await mockBaseApis(page);
    await page.goto('/', { waitUntil: 'networkidle' });

    // 1. Open Help Center and trigger the "Ask the Help Assistant" pre-fill
    await openHelpCenter(page);

    const searchInput = page.locator('[data-testid="help-search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 10_000 });

    const searchQuery = 'xyzzy-no-match-unique-12345';
    await searchInput.fill(searchQuery);

    const assistantBtn = page.locator('[data-testid="help-ask-assistant-btn"]');
    await expect(assistantBtn).toBeVisible({ timeout: 5_000 });
    await assistantBtn.click();

    // The chat input should now be pre-filled with the search query
    const chatInput = page.locator('[data-testid="help-chat-input"]');
    await expect(chatInput).toBeVisible({ timeout: 5_000 });
    await expect(chatInput).toHaveValue(searchQuery);

    // 2. Close the panel
    await closeHelpCenter(page);

    // 3. Simulate navigating to a different route (client-side)
    await page.evaluate(() => {
      window.history.pushState({}, '', '/jobs');
    });

    // 4. Reopen the panel
    await openHelpCenter(page);

    // The panel opens back on the Articles tab — switch to Chat
    await page.locator('[data-testid="help-tab-chat"]').click();

    // 5. The pre-fill must NOT carry forward to the chat input
    await expect(chatInput).toBeVisible({ timeout: 5_000 });
    await expect(chatInput).toHaveValue('');
  });

  test('shows a stale-session notice when the stored conversation is from a different route', async ({
    page,
  }) => {
    await mockBaseApis(page);
    await page.goto('/', { waitUntil: 'networkidle' });

    // Pre-populate sessionStorage with a conversation from a different route
    await page.evaluate(() => {
      sessionStorage.setItem(
        'help_chat_history',
        JSON.stringify({
          route: '/jobs',
          messages: [
            { role: 'user', content: 'How do I assign a team member?' },
            { role: 'assistant', content: 'Go to the job and click Assign...' },
          ],
        })
      );
    });

    // Simulate being on a different route from the stored one
    await page.evaluate(() => {
      window.history.pushState({}, '', '/settings');
    });

    // Open the Help Center and switch to the chat tab
    await openHelpCenter(page);
    await page.locator('[data-testid="help-tab-chat"]').click();

    // The stale-session notice must be visible
    await expect(page.locator('[data-testid="help-chat-stale-session-notice"]')).toBeVisible({
      timeout: 5_000,
    });
  });

  test('does NOT show a stale-session notice when the stored conversation is from the same route', async ({
    page,
  }) => {
    await mockBaseApis(page);
    await page.goto('/', { waitUntil: 'networkidle' });

    // Pre-populate sessionStorage with a conversation from the SAME route
    await page.evaluate(() => {
      sessionStorage.setItem(
        'help_chat_history',
        JSON.stringify({
          route: '/',
          messages: [
            { role: 'user', content: 'How do I create a job?' },
            { role: 'assistant', content: 'Click the New Job button...' },
          ],
        })
      );
    });

    // Open the Help Center and switch to the chat tab
    await openHelpCenter(page);
    await page.locator('[data-testid="help-tab-chat"]').click();

    // No stale-session notice should appear
    await expect(page.locator('[data-testid="help-chat-stale-session-notice"]')).not.toBeVisible();
  });
});
