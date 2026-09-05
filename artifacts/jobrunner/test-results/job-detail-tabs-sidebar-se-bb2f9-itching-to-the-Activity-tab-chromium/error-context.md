# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: job-detail-tabs.spec.ts >> sidebar sections remain visible after switching to the Activity tab
- Location: e2e/job-detail-tabs.spec.ts:393:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:22128/jobs/prj-1
Call log:
  - navigating to "http://localhost:22128/jobs/prj-1", waiting until "networkidle"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e6]:
    - heading "This site can’t be reached" [level=1] [ref=e7]
    - paragraph [ref=e8]:
      - strong [ref=e9]: localhost
      - text: refused to connect.
    - generic [ref=e10]:
      - paragraph [ref=e11]: "Try:"
      - list [ref=e12]:
        - listitem [ref=e13]: Checking the connection
        - listitem [ref=e14]:
          - link "Checking the proxy and the firewall" [ref=e15] [cursor=pointer]:
            - /url: "#buttons"
    - generic [ref=e16]: ERR_CONNECTION_REFUSED
  - generic [ref=e17]:
    - button "Reload" [ref=e19] [cursor=pointer]
    - button "Details" [ref=e20] [cursor=pointer]
```

# Test source

```ts
  297 |   await mockBaseApis(page);
  298 |   // SERVICE_CALL_JOB has status='scheduled' — stepper requires non-pending status
  299 |   await mockJobDetailApis(page, SERVICE_CALL_JOB);
  300 | 
  301 |   await page.goto(`/jobs/${SERVICE_CALL_JOB.id}`, { waitUntil: 'networkidle' });
  302 | 
  303 |   await expect(page.locator('[data-testid="job-detail-view"]')).toBeVisible({ timeout: 15000 });
  304 | 
  305 |   // The stepper renders when: isServiceCall && status !== 'pending' && !isTradie
  306 |   const stepper = page.locator('[data-testid="status-stepper"]');
  307 |   await expect(stepper).toBeVisible({ timeout: 10000 });
  308 | 
  309 |   // All four status steps must be present inside the stepper
  310 |   for (const label of ['Scheduled', 'In Progress', 'Complete', 'Invoiced']) {
  311 |     await expect(stepper.getByText(label)).toBeVisible();
  312 |   }
  313 | });
  314 | 
  315 | // ---------------------------------------------------------------------------
  316 | // Test 8 — Status stepper does NOT appear for a project
  317 | // ---------------------------------------------------------------------------
  318 | 
  319 | test('status stepper is not shown for a project', async ({ page }) => {
  320 |   await mockBaseApis(page);
  321 |   await mockJobDetailApis(page, PROJECT_JOB, { phases: PHASES });
  322 | 
  323 |   await page.goto(`/jobs/${PROJECT_JOB.id}`, { waitUntil: 'networkidle' });
  324 | 
  325 |   await expect(page.locator('[data-testid="job-detail-view"]')).toBeVisible({ timeout: 15000 });
  326 | 
  327 |   await expect(page.locator('[data-testid="status-stepper"]')).not.toBeVisible({ timeout: 5000 });
  328 | });
  329 | 
  330 | // ---------------------------------------------------------------------------
  331 | // Test 9 — Phase progress bar appears for a project with phases
  332 | // ---------------------------------------------------------------------------
  333 | 
  334 | test('phase progress bar is visible for a project that has phases', async ({ page }) => {
  335 |   await mockBaseApis(page);
  336 |   await mockJobDetailApis(page, PROJECT_JOB, { phases: PHASES });
  337 | 
  338 |   await page.goto(`/jobs/${PROJECT_JOB.id}`, { waitUntil: 'networkidle' });
  339 | 
  340 |   await expect(page.locator('[data-testid="job-detail-view"]')).toBeVisible({ timeout: 15000 });
  341 | 
  342 |   // Phase progress bar renders when isProject && phases.length > 0
  343 |   const progressBar = page.locator('[data-testid="phase-progress-bar"]');
  344 |   await expect(progressBar).toBeVisible({ timeout: 10000 });
  345 | 
  346 |   // PHASES has 1 complete out of 3 → shows completion text
  347 |   await expect(progressBar.getByText(/phase progress/i)).toBeVisible();
  348 |   await expect(progressBar.getByText(/1\s*\/\s*3/)).toBeVisible();
  349 | });
  350 | 
  351 | // ---------------------------------------------------------------------------
  352 | // Test 10 — Phase progress bar does NOT appear for a service call
  353 | // ---------------------------------------------------------------------------
  354 | 
  355 | test('phase progress bar is not shown for a service call', async ({ page }) => {
  356 |   await mockBaseApis(page);
  357 |   await mockJobDetailApis(page, SERVICE_CALL_JOB);
  358 | 
  359 |   await page.goto(`/jobs/${SERVICE_CALL_JOB.id}`, { waitUntil: 'networkidle' });
  360 | 
  361 |   await expect(page.locator('[data-testid="job-detail-view"]')).toBeVisible({ timeout: 15000 });
  362 | 
  363 |   await expect(page.locator('[data-testid="phase-progress-bar"]')).not.toBeVisible({ timeout: 5000 });
  364 | });
  365 | 
  366 | // ---------------------------------------------------------------------------
  367 | // Test 11 — Sidebar: client card, at-a-glance and quick links all visible
  368 | //            (service call)
  369 | // ---------------------------------------------------------------------------
  370 | 
  371 | test('sidebar client card, at-a-glance and quick links render for a service call', async ({ page }) => {
  372 |   await mockBaseApis(page);
  373 |   await mockJobDetailApis(page, SERVICE_CALL_JOB);
  374 | 
  375 |   await page.goto(`/jobs/${SERVICE_CALL_JOB.id}`, { waitUntil: 'networkidle' });
  376 | 
  377 |   await expect(page.locator('[data-testid="job-detail-view"]')).toBeVisible({ timeout: 15000 });
  378 | 
  379 |   // CLIENT fixture has name/email/phone; job fixture has address — client card renders
  380 |   await expect(page.locator('[data-testid="sidebar-client-card"]')).toBeVisible({ timeout: 10000 });
  381 | 
  382 |   // At a Glance is always rendered (no condition)
  383 |   await expect(page.locator('[data-testid="sidebar-at-a-glance"]')).toBeVisible({ timeout: 10000 });
  384 | 
  385 |   // Quick Links is rendered for non-tradie users (AUTH_USER is 'owner')
  386 |   await expect(page.locator('[data-testid="sidebar-quick-links"]')).toBeVisible({ timeout: 10000 });
  387 | });
  388 | 
  389 | // ---------------------------------------------------------------------------
  390 | // Test 12 — Sidebar sections persist when switching to a different tab
  391 | // ---------------------------------------------------------------------------
  392 | 
  393 | test('sidebar sections remain visible after switching to the Activity tab', async ({ page }) => {
  394 |   await mockBaseApis(page);
  395 |   await mockJobDetailApis(page, PROJECT_JOB, { phases: PHASES });
  396 | 
> 397 |   await page.goto(`/jobs/${PROJECT_JOB.id}`, { waitUntil: 'networkidle' });
      |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:22128/jobs/prj-1
  398 | 
  399 |   await expect(page.locator('[data-testid="job-detail-view"]')).toBeVisible({ timeout: 15000 });
  400 | 
  401 |   // Switch to Activity tab
  402 |   await page.locator('[data-testid="tab-activity"]').click();
  403 |   await expect(page.locator('[data-testid="tab-activity"][data-state="active"]')).toBeVisible({ timeout: 5000 });
  404 | 
  405 |   // Sidebar must still be visible after the tab switch
  406 |   await expect(page.locator('[data-testid="sidebar-at-a-glance"]')).toBeVisible({ timeout: 5000 });
  407 |   await expect(page.locator('[data-testid="sidebar-quick-links"]')).toBeVisible({ timeout: 5000 });
  408 | });
  409 | 
```