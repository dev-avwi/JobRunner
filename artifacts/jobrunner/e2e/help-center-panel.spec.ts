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
    { id: 'quotes-invoices', label: 'Quotes & Invoices', icon: 'file-text' },
  ],
  articles: [
    {
      id: 'art-1',
      category: 'getting-started',
      title: 'How to create your first job',
      summary: 'Learn how to create a job in JobRunner.',
      body: '## Getting Started\n\nStep 1: Go to Jobs.\n\nStep 2: Click **New Job**.\n\n- Fill in the job title\n- Set the client\n- Save',
    },
    {
      id: 'art-2',
      category: 'jobs',
      title: 'Managing job statuses',
      summary: 'Understand the lifecycle of a job.',
      body: 'Jobs move through several statuses:\n\n1. Pending\n2. In Progress\n3. Complete',
    },
    {
      id: 'art-3',
      category: 'quotes-invoices',
      title: 'How to send an invoice',
      summary: 'Learn how to create and send invoices to clients.',
      body: '## Invoices\n\nInvoices can be sent directly to your client via email.\n\n**To create an invoice:**\n\n1. Navigate to the Invoices page\n2. Click New Invoice\n3. Fill in the details and send',
    },
    {
      id: 'art-4',
      category: 'quotes-invoices',
      title: 'Invoice payment tracking',
      summary: 'Track which invoices have been paid.',
      body: 'Monitor payment status from the Invoices dashboard.',
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

async function openHelpCenter(page: Page) {
  await page.locator('[data-testid="button-help"]').click();
  await expect(page.locator('[data-testid="help-center-panel"]')).toBeVisible({ timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Help Center – panel loads articles and responds to chat', () => {
  test('opening the panel shows category chips and a list of articles', async ({ page }) => {
    await mockBaseApis(page);
    await page.goto('/', { waitUntil: 'networkidle' });

    await openHelpCenter(page);

    // Search input must be visible (articles tab is active by default)
    await expect(page.locator('[data-testid="help-search-input"]')).toBeVisible({ timeout: 10_000 });

    // Category chips — "All" plus at least the seeded categories
    await expect(page.locator('button', { hasText: 'All' }).first()).toBeVisible();
    await expect(page.locator('button', { hasText: 'Getting Started' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Jobs' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Quotes & Invoices' })).toBeVisible();

    // Switch to "All" to clear the route-based category pre-selection
    await page.locator('button', { hasText: 'All' }).first().click();

    // Article list — all seeded articles must now be visible
    await expect(page.locator('text=How to create your first job')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('text=Managing job statuses')).toBeVisible();
  });

  test('searching for "invoice" filters the list to relevant articles', async ({ page }) => {
    await mockBaseApis(page);
    await page.goto('/', { waitUntil: 'networkidle' });

    await openHelpCenter(page);

    const searchInput = page.locator('[data-testid="help-search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 10_000 });

    await searchInput.fill('invoice');

    // Invoice articles must be visible
    await expect(page.locator('text=How to send an invoice')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('text=Invoice payment tracking')).toBeVisible();

    // Non-matching articles must not be visible
    await expect(page.locator('text=How to create your first job')).not.toBeVisible();
    await expect(page.locator('text=Managing job statuses')).not.toBeVisible();
  });

  test('clicking an article opens the detail view with markdown rendered', async ({ page }) => {
    await mockBaseApis(page);
    await page.goto('/', { waitUntil: 'networkidle' });

    await openHelpCenter(page);

    // Wait for article list
    await expect(page.locator('text=How to create your first job')).toBeVisible({ timeout: 10_000 });

    // Click the first article
    await page.locator('text=How to create your first job').click();

    // Search input and category chips must be hidden in detail view
    await expect(page.locator('[data-testid="help-search-input"]')).not.toBeVisible();

    // Article heading must appear
    await expect(page.locator('text=How to create your first job').first()).toBeVisible({
      timeout: 5_000,
    });

    // Markdown must be rendered: heading from the body (## Getting Started) and bold text
    await expect(page.locator('h2', { hasText: 'Getting Started' })).toBeVisible();
    await expect(page.locator('strong', { hasText: 'New Job' })).toBeVisible();

    // Back button must be visible
    await expect(page.locator('button', { hasText: 'Back to articles' })).toBeVisible();
  });

  test('back button in article detail returns to the article list', async ({ page }) => {
    await mockBaseApis(page);
    await page.goto('/', { waitUntil: 'networkidle' });

    await openHelpCenter(page);

    await expect(page.locator('text=How to create your first job')).toBeVisible({ timeout: 10_000 });
    await page.locator('text=How to create your first job').click();

    // Confirm detail view opened
    await expect(page.locator('button', { hasText: 'Back to articles' })).toBeVisible({ timeout: 5_000 });

    // Click Back
    await page.locator('button', { hasText: 'Back to articles' }).click();

    // Article list must be restored
    await expect(page.locator('[data-testid="help-search-input"]')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('text=How to create your first job')).toBeVisible();
  });

  test('switching to the AI tab shows the chat input and starter prompts', async ({ page }) => {
    await mockBaseApis(page);
    await page.goto('/', { waitUntil: 'networkidle' });

    await openHelpCenter(page);

    // Click the "Ask AI" tab
    await page.locator('[data-testid="help-tab-chat"]').click();

    // Chat input and send button must be present
    await expect(page.locator('[data-testid="help-chat-input"]')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[data-testid="help-chat-send"]')).toBeVisible();

    // Starter prompts must be rendered (the component renders HELP_CHAT_STARTERS)
    await expect(page.locator('text=How do I create a quote?')).toBeVisible();
    await expect(page.locator('text=How do I add a team member?')).toBeVisible();
  });

  test('submitting a starter question returns a non-empty assistant response', async ({ page }) => {
    await mockBaseApis(page);

    // Mock the chat endpoint to return a canned assistant reply
    await page.route('**/api/help/chat', (r) =>
      r.fulfill(
        json({
          response:
            'To create a quote, go to the Quotes page and click New Quote. Fill in the client and line items, then save.',
          relatedArticles: [],
          confidence: 'high',
        })
      )
    );

    await page.goto('/', { waitUntil: 'networkidle' });

    await openHelpCenter(page);
    await page.locator('[data-testid="help-tab-chat"]').click();

    // Wait for starter prompts to be rendered
    const starterBtn = page.locator('text=How do I create a quote?');
    await expect(starterBtn).toBeVisible({ timeout: 5_000 });

    // Click the starter prompt to submit it
    await starterBtn.click();

    // The assistant's response must appear (non-empty text from the mock)
    await expect(
      page.locator('text=To create a quote, go to the Quotes page')
    ).toBeVisible({ timeout: 10_000 });

    // The user message must also be in the thread
    await expect(page.locator('text=How do I create a quote?').first()).toBeVisible();
  });
});
