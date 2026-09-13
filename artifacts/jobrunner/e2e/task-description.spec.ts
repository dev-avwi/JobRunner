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
  id: 'client-td',
  name: 'Description Test Corp',
  email: 'desc@example.com',
  phone: '0400000099',
};

const JOB = {
  id: 'td-job-1',
  title: 'Roof inspection',
  status: 'in_progress',
  jobType: 'service_call',
  clientId: 'client-td',
  address: '1 Test St, Sydney NSW 2000',
  scheduledAt: new Date(Date.now() + 86400000).toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

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
        conflictCount: 0, overdueJobs: 0, unassignedJobs: 0,
        overCapacityWorkers: 0, overdueInvoices: 0, conflicts: [],
      })
    )
  );
  await page.route('**/api/ops/job-aging', (r) =>
    r.fulfill(json({ totalAging: 0, criticalCount: 0, agingJobs: [] }))
  );
  await page.route('**/api/ai/schedule-suggestions**', (r) =>
    r.fulfill(json({ suggestions: [] }))
  );
  // Match /api/jobs and /api/jobs?... (query-param variants from the job list page)
  await page.route('**/api/jobs**', (r) => r.fulfill(json([])));
}

/**
 * Register all endpoints needed by the job detail page.
 * `tasks` controls what GET /api/jobs/${JOB.id}/tasks returns.
 */
async function mockJobDetailApis(page: Page, tasks: object[] = []) {
  const id = JOB.id;

  await page.route(`**/api/jobs/${id}`, (r) => r.fulfill(json(JOB)));
  await page.route(`**/api/clients/${CLIENT.id}`, (r) => r.fulfill(json(CLIENT)));
  await page.route(`**/api/jobs/${id}/linked-documents`, (r) =>
    r.fulfill(json(EMPTY_LINKED_DOCS))
  );
  await page.route(`**/api/jobs/${id}/assignments`, (r) => r.fulfill(json([])));
  await page.route(`**/api/jobs/${id}/activity**`, (r) => r.fulfill(json([])));
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
  await page.route(`**/api/jobs/${id}/phases`, (r) => r.fulfill(json([])));
  await page.route(`**/api/jobs/${id}/defect-items`, (r) => r.fulfill(json([])));
  await page.route(`**/api/clients/${CLIENT.id}/portal-url`, (r) =>
    r.fulfill({ status: 404, body: '' })
  );
  await page.route(`**/api/jobs/${id}/checklist`, (r) => r.fulfill(json([])));
  await page.route(`**/api/jobs/${id}/tasks`, (r) => r.fulfill(json(tasks)));
  await page.route(`**/api/jobs/${id}/forms**`, (r) => r.fulfill(json([])));
  await page.route(`**/api/forms**`, (r) => r.fulfill(json([])));
}

/**
 * Navigate to the job detail page and activate the Activity tab,
 * where UnifiedWorkSection lives.
 */
async function gotoActivityTab(page: Page) {
  await page.goto(`/jobs/${JOB.id}?tab=activity`, { waitUntil: 'load' });
  await expect(page.locator('[data-testid="job-detail-view"]')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-testid="tab-activity"]')).toBeVisible({ timeout: 10000 });
  await page.locator('[data-testid="tab-activity"]').click();
  await expect(page.locator('[data-testid="tab-activity"][data-state="active"]')).toBeVisible({ timeout: 5000 });
}

// ---------------------------------------------------------------------------
// Test 1 — Create task with markdown description via the create dialog.
//           Verify the POST body contains the description and the rendered
//           markdown heading/list text appears in the task row.
// ---------------------------------------------------------------------------

test('creating a task with a markdown description sends it in the POST body and renders it in the list', async ({ page }) => {
  const createdTask = {
    id: 'task-new-1',
    title: 'Inspect guttering',
    description: '## Safety steps\n- Wear PPE\n- Secure ladder',
    status: 'open',
    source: null,
  };

  let capturedPostBody: Record<string, unknown> | null = null;

  await mockBaseApis(page);
  await mockJobDetailApis(page, []); // no tasks initially

  // Intercept POST /api/tasks to capture the payload and return the created task
  await page.route('**/api/tasks', async (route) => {
    if (route.request().method() === 'POST') {
      capturedPostBody = JSON.parse(route.request().postData() ?? '{}');
      // On next tasks fetch, return the created task
      await page.route(`**/api/jobs/${JOB.id}/tasks`, (r) => r.fulfill(json([createdTask])));
      await route.fulfill(json(createdTask));
    } else {
      await route.continue();
    }
  });

  await gotoActivityTab(page);

  // UnifiedWorkSection must be visible on the Activity tab
  const workSection = page.locator('[data-testid="unified-work-section"]');
  await expect(workSection).toBeVisible({ timeout: 10000 });

  // Switch to "Full task" mode so the + button opens the description dialog
  await page.locator('[data-testid="toggle-add-mode-task"]').click();

  // Type a title in the quick-add input
  await page.locator('[data-testid="input-new-work-item"]').fill('Inspect guttering');

  // Click + to open the create-with-description dialog
  await page.locator('[data-testid="button-add-work-item"]').click();

  // Dialog must appear
  const dialog = page.locator('[data-testid="dialog-create-task"]');
  await expect(dialog).toBeVisible({ timeout: 8000 });

  // Title is pre-filled from the quick-add input
  await expect(dialog.locator('[data-testid="input-create-task-title"]')).toHaveValue('Inspect guttering');

  // Enter the markdown description
  await dialog.locator('[data-testid="textarea-create-task-desc"]').fill(
    '## Safety steps\n- Wear PPE\n- Secure ladder'
  );

  // Submit
  await dialog.locator('[data-testid="button-confirm-add-task"]').click();
  await expect(dialog).not.toBeVisible({ timeout: 8000 });

  // Assert POST body: description must be present with the exact content
  expect(capturedPostBody).not.toBeNull();
  expect(capturedPostBody!['title']).toBe('Inspect guttering');
  expect(capturedPostBody!['jobId']).toBe(JOB.id);
  expect(capturedPostBody!['description']).toBe('## Safety steps\n- Wear PPE\n- Secure ladder');

  // The task row must appear and show the markdown description content
  const taskRow = page.locator(`[data-testid="job-task-${createdTask.id}"]`);
  await expect(taskRow).toBeVisible({ timeout: 10000 });
  // ReactMarkdown renders ## as a heading element — its text content is still findable
  await expect(taskRow.getByText('Safety steps')).toBeVisible();
  await expect(taskRow.getByText('Wear PPE')).toBeVisible();
  await expect(taskRow.getByText('Secure ladder')).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 2 — Creating a task without a description omits the description key
//           from the POST body (not sent as null or empty string).
// ---------------------------------------------------------------------------

test('creating a task without a description sends no description key in the POST body', async ({ page }) => {
  const createdTask = {
    id: 'task-nodesc-1',
    title: 'Quick task',
    description: null,
    status: 'open',
    source: null,
  };

  let capturedPostBody: Record<string, unknown> | null = null;

  await mockBaseApis(page);
  await mockJobDetailApis(page, []);

  await page.route('**/api/tasks', async (route) => {
    if (route.request().method() === 'POST') {
      capturedPostBody = JSON.parse(route.request().postData() ?? '{}');
      await page.route(`**/api/jobs/${JOB.id}/tasks`, (r) => r.fulfill(json([createdTask])));
      await route.fulfill(json(createdTask));
    } else {
      await route.continue();
    }
  });

  await gotoActivityTab(page);
  await page.locator('[data-testid="toggle-add-mode-task"]').click();
  await page.locator('[data-testid="input-new-work-item"]').fill('Quick task');
  await page.locator('[data-testid="button-add-work-item"]').click();

  const dialog = page.locator('[data-testid="dialog-create-task"]');
  await expect(dialog).toBeVisible({ timeout: 8000 });

  // Leave description empty and submit immediately
  await dialog.locator('[data-testid="button-confirm-add-task"]').click();
  await expect(dialog).not.toBeVisible({ timeout: 8000 });

  // description key must be absent — not null, not ""
  expect(capturedPostBody).not.toBeNull();
  expect(capturedPostBody!['title']).toBe('Quick task');
  expect(Object.keys(capturedPostBody!)).not.toContain('description');
});

// ---------------------------------------------------------------------------
// Test 3 — Edit dialog pre-populates the saved description; saving sends the
//           updated content in the PATCH body without a status field.
// ---------------------------------------------------------------------------

test('edit dialog pre-populates saved description and PATCH body contains only description', async ({ page }) => {
  const existingTask = {
    id: 'task-edit-1',
    title: 'Scaffold check',
    description: '## Original heading\n- Step A\n- Step B',
    status: 'open',
    source: null,
  };

  let capturedPatchBody: Record<string, unknown> | null = null;

  await mockBaseApis(page);
  await mockJobDetailApis(page, [existingTask]);

  await page.route(`**/api/tasks/${existingTask.id}`, async (route) => {
    if (route.request().method() === 'PATCH') {
      capturedPatchBody = JSON.parse(route.request().postData() ?? '{}');
      const updated = { ...existingTask, description: capturedPatchBody!['description'] as string };
      await page.route(`**/api/jobs/${JOB.id}/tasks`, (r) => r.fulfill(json([updated])));
      await route.fulfill(json(updated));
    } else {
      await route.continue();
    }
  });

  await gotoActivityTab(page);

  const taskRow = page.locator(`[data-testid="job-task-${existingTask.id}"]`);
  await expect(taskRow).toBeVisible({ timeout: 10000 });

  // Open edit dialog via the FileText icon button
  await taskRow.locator(`[data-testid="button-edit-desc-task-${existingTask.id}"]`).click();

  const editDialog = page.locator('[data-testid="dialog-edit-desc"]');
  await expect(editDialog).toBeVisible({ timeout: 8000 });

  // Textarea must be pre-populated with the saved description
  const editTextarea = editDialog.locator('[data-testid="textarea-edit-task-desc"]');
  await expect(editTextarea).toHaveValue(existingTask.description);

  // Update the content
  await editTextarea.fill('## Updated heading\n- New step 1\n- New step 2');

  // Save
  await editDialog.locator('[data-testid="button-confirm-save-desc"]').click();
  await expect(editDialog).not.toBeVisible({ timeout: 8000 });

  // PATCH body must contain the new description and must not include a status field
  expect(capturedPatchBody).not.toBeNull();
  expect(capturedPatchBody!['description']).toBe('## Updated heading\n- New step 1\n- New step 2');
  expect(capturedPatchBody).not.toHaveProperty('status');

  // Updated content must appear in the task row
  await expect(taskRow.getByText('Updated heading')).toBeVisible({ timeout: 8000 });
});

// ---------------------------------------------------------------------------
// Test 4 — Clearing a description sends description: null in the PATCH body
//           and the description content is no longer visible in the task row.
// ---------------------------------------------------------------------------

test('clearing a description sends description: null in PATCH body and removes it from the row', async ({ page }) => {
  const taskWithDesc = {
    id: 'task-clear-1',
    title: 'Safety briefing',
    description: '## Before you start\n- Check equipment',
    status: 'open',
    source: null,
  };
  const taskCleared = { ...taskWithDesc, description: null };

  let capturedPatchBody: Record<string, unknown> | null = null;

  await mockBaseApis(page);
  await mockJobDetailApis(page, [taskWithDesc]);

  await page.route(`**/api/tasks/${taskWithDesc.id}`, async (route) => {
    if (route.request().method() === 'PATCH') {
      capturedPatchBody = JSON.parse(route.request().postData() ?? '{}');
      await page.route(`**/api/jobs/${JOB.id}/tasks`, (r) => r.fulfill(json([taskCleared])));
      await route.fulfill(json(taskCleared));
    } else {
      await route.continue();
    }
  });

  await gotoActivityTab(page);

  const taskRow = page.locator(`[data-testid="job-task-${taskWithDesc.id}"]`);
  await expect(taskRow).toBeVisible({ timeout: 10000 });
  // Description is visible before clearing
  await expect(taskRow.getByText('Before you start')).toBeVisible();

  // Open edit dialog
  await taskRow.locator(`[data-testid="button-edit-desc-task-${taskWithDesc.id}"]`).click();
  const editDialog = page.locator('[data-testid="dialog-edit-desc"]');
  await expect(editDialog).toBeVisible({ timeout: 8000 });

  // The Clear button is visible because the description is non-empty
  const clearBtn = editDialog.locator('[data-testid="button-confirm-clear-desc"]');
  await expect(clearBtn).toBeVisible();

  await clearBtn.click();
  await expect(editDialog).not.toBeVisible({ timeout: 8000 });

  // PATCH body must be { description: null } — not "" and not missing
  expect(capturedPatchBody).not.toBeNull();
  expect(capturedPatchBody!['description']).toBeNull();
  expect(capturedPatchBody).not.toHaveProperty('status');

  // Description content must be gone from the row
  await expect(taskRow.getByText('Before you start')).not.toBeVisible({ timeout: 8000 });
});

// ---------------------------------------------------------------------------
// Test 5 — Completing a task sends only the status field in the PATCH body.
//           The description key must be absent — it must not be sent as null
//           alongside the status toggle.
// ---------------------------------------------------------------------------

test('completing a task sends only status in PATCH body — description field is absent', async ({ page }) => {
  const taskWithDesc = {
    id: 'task-toggle-1',
    title: 'Install ridge cap',
    description: '## Steps\n- Measure\n- Cut\n- Fix',
    status: 'open',
    source: null,
  };
  const taskCompleted = { ...taskWithDesc, status: 'done' };

  let capturedPatchBody: Record<string, unknown> | null = null;

  await mockBaseApis(page);
  await mockJobDetailApis(page, [taskWithDesc]);

  await page.route(`**/api/tasks/${taskWithDesc.id}`, async (route) => {
    if (route.request().method() === 'PATCH') {
      capturedPatchBody = JSON.parse(route.request().postData() ?? '{}');
      await page.route(`**/api/jobs/${JOB.id}/tasks`, (r) => r.fulfill(json([taskCompleted])));
      await route.fulfill(json(taskCompleted));
    } else {
      await route.continue();
    }
  });

  await gotoActivityTab(page);

  const taskRow = page.locator(`[data-testid="job-task-${taskWithDesc.id}"]`);
  await expect(taskRow).toBeVisible({ timeout: 10000 });
  // Description is visible before toggling
  await expect(taskRow.getByText('Measure')).toBeVisible();

  // Click the checkbox to complete the task
  await taskRow.locator(`[data-testid="checkbox-task-${taskWithDesc.id}"]`).click();

  // Row title must become line-through (done state)
  await expect(taskRow.locator('p.line-through')).toBeVisible({ timeout: 8000 });

  // PATCH body must have status: 'done' and must not include description at all
  expect(capturedPatchBody).not.toBeNull();
  expect(capturedPatchBody!['status']).toBe('done');
  expect(Object.keys(capturedPatchBody!)).not.toContain('description');

  // Description content must still be visible — completion does not wipe it
  await expect(taskRow.getByText('Measure')).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 6 — Simulated reload: description is preserved after the page
//           re-fetches from the server.
// ---------------------------------------------------------------------------

test('description is still visible after navigating away and returning (simulated reload)', async ({ page }) => {
  const task = {
    id: 'task-persist-1',
    title: 'Waterproofing check',
    description: '## Required\n- Sealant\n- Membrane',
    status: 'open',
    source: null,
  };

  await mockBaseApis(page);
  await mockJobDetailApis(page, [task]);

  // First visit
  await gotoActivityTab(page);
  const taskRow = page.locator(`[data-testid="job-task-${task.id}"]`);
  await expect(taskRow).toBeVisible({ timeout: 10000 });
  await expect(taskRow.getByText('Sealant')).toBeVisible();

  // Navigate away then back — triggers a full re-fetch.
  // Use 'load' (not 'networkidle') because the job list page may keep background
  // requests open that prevent networkidle within the test timeout.
  await page.goto('/jobs', { waitUntil: 'load' });
  await gotoActivityTab(page);

  const taskRowAfterReturn = page.locator(`[data-testid="job-task-${task.id}"]`);
  await expect(taskRowAfterReturn).toBeVisible({ timeout: 10000 });
  await expect(taskRowAfterReturn.getByText('Required')).toBeVisible();
  await expect(taskRowAfterReturn.getByText('Sealant')).toBeVisible();
});
