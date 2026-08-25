import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Shared mock fixtures (mirrors dispatch-skeleton.spec.ts)
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
  // Explicit schedule hours so WORK_HOURS = [6..20] in every environment
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

/**
 * Navigate to the dispatch board and wait until the board container is
 * visible. Using 'domcontentloaded' + an explicit element wait is more
 * reliable than 'networkidle', which can hang when background requests
 * keep the network busy after the initial render.
 */
async function gotoBoard(page: Page) {
  // /dispatch-board now redirects to the unified /dispatch page.
  await page.goto('/dispatch', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-testid="dispatch-board"]')).toBeVisible({ timeout: 15000 });
}

/**
 * Build a local-time ISO string (no Z suffix) so that
 * `new Date(str).getHours()` returns `hour` in any server timezone.
 */
function localIso(date: Date, hour: number, minute = 0): string {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
  );
}

/**
 * Return a date that is guaranteed to fall within the same ISO week as today.
 * Picks today+1 unless that crosses a week boundary (Sun→Mon), in which case
 * it returns today-1 instead. Either way the result is Mon–Sun of this week.
 */
function sameDayPlusOne(today: Date): Date {
  const next = new Date(today);
  next.setDate(today.getDate() + 1);
  // If tomorrow is Monday (getDay()===1) it belongs to the NEXT week
  if (next.getDay() === 1) {
    next.setDate(today.getDate() - 1); // use yesterday instead
  }
  return next;
}

/**
 * Simulate HTML5 drag-and-drop in two separate evaluate() calls with a wait
 * between them. React's draggedPhase state update (set on dragstart) is
 * asynchronous; firing dragstart and drop in the same microtask means
 * draggedPhase is still null when handlePhaseDrop runs, so the drop no-ops.
 */
async function simulateDrag(page: Page, sourceSel: string, targetSel: string) {
  // 1. dragstart — triggers setDraggedPhase(phase) in React
  await page.evaluate(({ src }) => {
    const el = document.querySelector(src);
    if (!el) throw new Error(`Drag source not found: ${src}`);
    el.dispatchEvent(
      new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }),
    );
  }, { src: sourceSel });

  // Wait for React to commit the draggedPhase state update before we drop
  await page.waitForTimeout(150);

  // 2. dragover + drop — handlePhaseDrop reads draggedPhase (now non-null)
  await page.evaluate(({ tgt }) => {
    const el = document.querySelector(tgt);
    if (!el) throw new Error(`Drop target not found: ${tgt}`);
    const dt = new DataTransfer();
    el.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
    el.dispatchEvent(new DragEvent('drop',     { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, { tgt: targetSel });

  // 3. dragend — clears draggedPhase state
  await page.evaluate(({ src }) => {
    document.querySelector(src)?.dispatchEvent(
      new DragEvent('dragend', { bubbles: true, cancelable: true }),
    );
  }, { src: sourceSel });
}

// ---------------------------------------------------------------------------
// Test 1 — Phase survives a page reload and shows at the rescheduled time
// ---------------------------------------------------------------------------

test.skip('phase scheduling survives a page reload and shows at the rescheduled time', async ({ page }) => {
  // Phase blocks are not yet rendered in the unified /dispatch page (AdvancedDispatch).
  // Re-enable this test once phase block display is added to AdvancedDispatch (see task #966).
  await mockBaseApis(page);

  const today = new Date();

  // Phases with no assignees fall into the owner lane (id: 'owner').
  // Slot testids: slot-owner-{hour}
  const PHASE = {
    id: 'phase-persist-1',
    jobId: 'job-persist-1',
    phaseCode: 'FOUND',
    name: 'Foundation',
    scheduledStart: localIso(today, 9),
    scheduledEnd:   localIso(today, 11),
    bookedHours:    '2',
    status: 'not_started',
    sortOrder: 1,
    assignedUserId:  null,
    assignedUserIds: [],
    assignedUsers:   [],
    jobTitle: 'Rebuild Project',
    jobType: 'project',
  };

  let patchedBody: Record<string, string> | null = null;
  let servedPhase = { ...PHASE };

  await page.route('**/api/dispatch/phases', (route) =>
    route.fulfill(json([servedPhase]))
  );
  await page.route('**/api/jobs/job-persist-1/phases/phase-persist-1', async (route) => {
    if (route.request().method() === 'PATCH') {
      patchedBody = JSON.parse(route.request().postData() ?? '{}');
      // Merge to simulate DB persistence; future GET /dispatch/phases returns new time
      servedPhase = { ...servedPhase, ...(patchedBody ?? {}) };
      await route.fulfill(json(servedPhase));
    } else {
      await route.continue();
    }
  });

  // ── First load: default topView='schedule', viewMode='day' ────────────────
  await gotoBoard(page);

  const phaseBlock = page.locator('[data-testid="scheduled-phase-phase-persist-1"]');
  await expect(phaseBlock).toBeVisible({ timeout: 10000 });
  await expect(phaseBlock).toContainText('9:00 AM');

  // ── Drag from hour 9 to hour 14 in the owner lane ─────────────────────────
  await simulateDrag(
    page,
    '[data-testid="scheduled-phase-phase-persist-1"]',
    '[data-testid="slot-owner-14"]',
  );
  // Allow the mutation + cache invalidation + refetch to complete
  await page.waitForTimeout(500);

  // Verify PATCH body carries the correct timestamps
  expect(patchedBody).not.toBeNull();
  const patchedStart = new Date((patchedBody as any).scheduledStart);
  const patchedEnd   = new Date((patchedBody as any).scheduledEnd);
  // scheduledStart must be today at 14:00
  expect(patchedStart.getHours()).toBe(14);
  expect(patchedStart.toDateString()).toBe(today.toDateString());
  // Original 2-hour duration preserved → scheduledEnd at 16:00, same day
  expect(patchedEnd.getHours()).toBe(16);
  expect(patchedEnd.toDateString()).toBe(today.toDateString());

  // ── Reload: phase still shows at the new time ─────────────────────────────
  await gotoBoard(page);
  await expect(phaseBlock).toBeVisible({ timeout: 10000 });
  await expect(phaseBlock).toContainText('2:00 PM');
});

// ---------------------------------------------------------------------------
// Test 2 — Phase with no scheduledEnd uses bookedHours as the duration hint
// ---------------------------------------------------------------------------

test.skip('phase with no scheduledEnd uses bookedHours as the duration hint after reload', async ({ page }) => {
  // Phase blocks are not yet rendered in the unified /dispatch page (AdvancedDispatch).
  // Re-enable this test once phase block display is added to AdvancedDispatch (see task #966).
  await mockBaseApis(page);

  const today = new Date();

  const PHASE_NO_END = {
    id: 'phase-no-end-1',
    jobId: 'job-no-end-1',
    phaseCode: 'FRAME',
    name: 'Framing',
    scheduledStart: localIso(today, 10),
    scheduledEnd:   null,      // ← no scheduledEnd
    bookedHours:    '1.5',     // 90 min — handlePhaseDrop falls back to this
    status: 'not_started',
    sortOrder: 1,
    assignedUserId:  null,
    assignedUserIds: [],
    assignedUsers:   [],
    jobTitle: 'Framing Project',
    jobType: 'project',
  };

  let patchedBody: Record<string, string> | null = null;
  let servedPhase: typeof PHASE_NO_END & { scheduledEnd?: string | null } = { ...PHASE_NO_END };

  await page.route('**/api/dispatch/phases', (route) =>
    route.fulfill(json([servedPhase]))
  );
  await page.route('**/api/jobs/job-no-end-1/phases/phase-no-end-1', async (route) => {
    if (route.request().method() === 'PATCH') {
      patchedBody = JSON.parse(route.request().postData() ?? '{}');
      servedPhase = { ...servedPhase, ...(patchedBody ?? {}) } as any;
      await route.fulfill(json(servedPhase));
    } else {
      await route.continue();
    }
  });

  // ── First load: phase renders even with no scheduledEnd ───────────────────
  await gotoBoard(page);

  const phaseBlock = page.locator('[data-testid="scheduled-phase-phase-no-end-1"]');
  await expect(phaseBlock).toBeVisible({ timeout: 10000 });
  await expect(phaseBlock).toContainText('10:00 AM');

  // ── Drag to hour 13 ───────────────────────────────────────────────────────
  await simulateDrag(
    page,
    '[data-testid="scheduled-phase-phase-no-end-1"]',
    '[data-testid="slot-owner-13"]',
  );
  await page.waitForTimeout(500);

  // handlePhaseDrop computes scheduledEnd from bookedHours when scheduledEnd is null
  expect(patchedBody).not.toBeNull();
  const patchedStart = new Date((patchedBody as any).scheduledStart);
  const patchedEnd   = new Date((patchedBody as any).scheduledEnd);
  // Start: 13:00
  expect(patchedStart.getHours()).toBe(13);
  expect(patchedStart.getMinutes()).toBe(0);
  // 13:00 + 90 min = 14:30
  expect(patchedEnd.getHours()).toBe(14);
  expect(patchedEnd.getMinutes()).toBe(30);

  // ── Reload: phase shows at the new time ───────────────────────────────────
  await gotoBoard(page);
  await expect(phaseBlock).toBeVisible({ timeout: 10000 });
  await expect(phaseBlock).toContainText('1:00 PM');
});

// ---------------------------------------------------------------------------
// Test 3 — Phase near end-of-day: correct timestamps even when end > grid
// ---------------------------------------------------------------------------

test.skip('phase with scheduledStart late in the day still shows on that day after reload', async ({ page }) => {
  // Phase blocks are not yet rendered in the unified /dispatch page (AdvancedDispatch).
  // Re-enable this test once phase block display is added to AdvancedDispatch (see task #966).
  await mockBaseApis(page);

  const today = new Date();

  // A 3-hour phase at 18:00 → scheduledEnd 21:00, which is past scheduleEndHour (20).
  // getPhasePosition clamps the rendered block height, but the PATCH must still
  // carry the mathematically correct scheduledEnd (21:00, same day).
  const PHASE_LATE = {
    id: 'phase-late-1',
    jobId: 'job-late-1',
    phaseCode: 'ELEC',
    name: 'Electrical',
    scheduledStart: localIso(today, 18),
    scheduledEnd:   localIso(today, 21),
    bookedHours:    '3',
    status: 'not_started',
    sortOrder: 1,
    assignedUserId:  null,
    assignedUserIds: [],
    assignedUsers:   [],
    jobTitle: 'Electrical Run',
    jobType: 'project',
  };

  let patchedBody: Record<string, string> | null = null;
  let servedPhase = { ...PHASE_LATE };

  await page.route('**/api/dispatch/phases', (route) =>
    route.fulfill(json([servedPhase]))
  );
  await page.route('**/api/jobs/job-late-1/phases/phase-late-1', async (route) => {
    if (route.request().method() === 'PATCH') {
      patchedBody = JSON.parse(route.request().postData() ?? '{}');
      servedPhase = { ...servedPhase, ...(patchedBody ?? {}) };
      await route.fulfill(json(servedPhase));
    } else {
      await route.continue();
    }
  });

  // ── First load: phase is visible at 6 PM ─────────────────────────────────
  await gotoBoard(page);

  const phaseBlock = page.locator('[data-testid="scheduled-phase-phase-late-1"]');
  await expect(phaseBlock).toBeVisible({ timeout: 10000 });
  await expect(phaseBlock).toContainText('6:00 PM');

  // ── Drag to hour 19 — last full hour within WORK_HOURS (6–20) ────────────
  await simulateDrag(
    page,
    '[data-testid="scheduled-phase-phase-late-1"]',
    '[data-testid="slot-owner-19"]',
  );
  await page.waitForTimeout(500);

  // PATCH must carry: start=19:00 today, end=22:00 today (19 + 3 h)
  expect(patchedBody).not.toBeNull();
  const patchedStart = new Date((patchedBody as any).scheduledStart);
  const patchedEnd   = new Date((patchedBody as any).scheduledEnd);
  expect(patchedStart.getHours()).toBe(19);
  expect(patchedStart.toDateString()).toBe(today.toDateString());
  // 19:00 + 180 min = 22:00, still the same calendar day
  expect(patchedEnd.getHours()).toBe(22);
  expect(patchedEnd.toDateString()).toBe(today.toDateString());

  // ── Reload: phase still appears on today's grid ───────────────────────────
  await gotoBoard(page);
  await expect(phaseBlock).toBeVisible({ timeout: 10000 });
  await expect(phaseBlock).toContainText('7:00 PM');
});

// ---------------------------------------------------------------------------
// Test 4 — Week view: phase appears under the correct date column after reload
// ---------------------------------------------------------------------------

test.skip('phase appears in the correct week-view column on the right day after reload', async ({ page }) => {
  // Phase blocks are not yet rendered in the unified /dispatch page (AdvancedDispatch).
  // Re-enable this test once phase block display is added to AdvancedDispatch (see task #966).
  await mockBaseApis(page);

  const today = new Date();

  // Pick a date that is guaranteed to be in the SAME displayed week as today.
  // sameDayPlusOne returns today+1 unless that crosses into the next week
  // (i.e., tomorrow would be Monday), in which case it returns today-1.
  const targetDay = sameDayPlusOne(today);

  const PHASE = {
    id: 'phase-week-col-1',
    jobId: 'job-week-col-1',
    phaseCode: 'PLUMB',
    name: 'Plumbing',
    scheduledStart: localIso(targetDay, 10),
    scheduledEnd:   localIso(targetDay, 12),
    bookedHours:    '2',
    status: 'not_started',
    sortOrder: 1,
    assignedUserId:  null,
    assignedUserIds: [],
    assignedUsers:   [],
    jobTitle: 'Plumbing Project',
    jobType: 'project',
  };

  await page.route('**/api/dispatch/phases', (route) =>
    route.fulfill(json([PHASE]))
  );

  // ── First load: switch to week view ──────────────────────────────────────
  await gotoBoard(page);

  const dispatchBoard = page.locator('[data-testid="dispatch-board"]');
  const weekBtn = dispatchBoard.getByRole('button', { name: /^week$/i });
  await expect(weekBtn).toBeVisible({ timeout: 5000 });
  await weekBtn.click();

  // Phase block must be visible in the week grid
  const phaseBlockWeek = page.locator('[data-testid="week-phase-phase-week-col-1"]');
  await expect(phaseBlockWeek).toBeVisible({ timeout: 10000 });

  // ── Assert the block is in the correct date column ────────────────────────
  // Each week-view column header (<th>) shows the short day name (e.g. "Tue")
  // and the day-of-month number (e.g. "26"). Locate the column by its unique
  // day number text, then verify the phase block overlaps it horizontally.
  const dayNumber = String(targetDay.getDate());
  // The day number lives in a <p> inside a <th>; use the closest <th> ancestor
  const columnHeader = page
    .locator('thead th')
    .filter({ has: page.locator('p', { hasText: new RegExp(`^${dayNumber}$`) }) })
    .first();
  await expect(columnHeader).toBeVisible({ timeout: 5000 });

  const headerBox = await columnHeader.boundingBox();
  const phaseBox  = await phaseBlockWeek.boundingBox();
  expect(headerBox).not.toBeNull();
  expect(phaseBox).not.toBeNull();

  // The horizontal centre of the phase block must lie within the column header
  const phaseCentreX = phaseBox!.x + phaseBox!.width / 2;
  expect(phaseCentreX).toBeGreaterThanOrEqual(headerBox!.x);
  expect(phaseCentreX).toBeLessThanOrEqual(headerBox!.x + headerBox!.width);

  // ── Reload: phase still shows in the same column ─────────────────────────
  await gotoBoard(page);

  const dispatchBoardAfter = page.locator('[data-testid="dispatch-board"]');
  const weekBtnAfter = dispatchBoardAfter.getByRole('button', { name: /^week$/i });
  await expect(weekBtnAfter).toBeVisible({ timeout: 5000 });
  await weekBtnAfter.click();

  // Phase must still be visible after reload
  await expect(phaseBlockWeek).toBeVisible({ timeout: 10000 });

  // Column alignment must be preserved after reload
  const headerBoxAfter = await columnHeader.boundingBox();
  const phaseBoxAfter  = await phaseBlockWeek.boundingBox();
  expect(headerBoxAfter).not.toBeNull();
  expect(phaseBoxAfter).not.toBeNull();

  const phaseCentreXAfter = phaseBoxAfter!.x + phaseBoxAfter!.width / 2;
  expect(phaseCentreXAfter).toBeGreaterThanOrEqual(headerBoxAfter!.x);
  expect(phaseCentreXAfter).toBeLessThanOrEqual(headerBoxAfter!.x + headerBoxAfter!.width);
});
