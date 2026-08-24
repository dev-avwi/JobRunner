# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dispatch-skeleton.spec.ts >> shows ops health error banner when /api/ops/health fails
- Location: e2e/dispatch-skeleton.spec.ts:407:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:22128/dispatch-board
Call log:
  - navigating to "http://localhost:22128/dispatch-board", waiting until "networkidle"

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
  319 | 
  320 |   // The job type picker must be visible first.
  321 |   const typePicker = page.locator('[data-testid="page-job-type-picker"]');
  322 |   await expect(typePicker).toBeVisible({ timeout: 10000 });
  323 | 
  324 |   // Click "Project" — this enables the /api/project-templates query.
  325 |   await page.click('[data-testid="card-job-type-project"]');
  326 | 
  327 |   // The template picker page renders.
  328 |   const templatePicker = page.locator('[data-testid="page-template-picker"]');
  329 |   await expect(templatePicker).toBeVisible({ timeout: 10000 });
  330 | 
  331 |   // While the request is held, the loading skeleton must be visible.
  332 |   const skeleton = page.locator('[data-testid="template-picker-skeleton"]');
  333 |   await expect(skeleton).toBeVisible({ timeout: 5000 });
  334 | 
  335 |   // Release the held request and verify the skeleton disappears.
  336 |   resolveTemplates();
  337 |   await expect(skeleton).not.toBeVisible({ timeout: 10000 });
  338 | });
  339 | 
  340 | // ---------------------------------------------------------------------------
  341 | // Test 6 — Template picker error state recovers after Retry
  342 | // ---------------------------------------------------------------------------
  343 | 
  344 | test('template picker error state recovers and shows templates after clicking Retry', async ({ page }) => {
  345 |   await mockBaseApis(page);
  346 | 
  347 |   const TEMPLATE = {
  348 |     id: 'tpl-retry-test',
  349 |     name: 'Retry Recovery Template',
  350 |     description: 'Template that appears after retry',
  351 |     templateData: {
  352 |       phases: [],
  353 |       checklist: [],
  354 |     },
  355 |   };
  356 | 
  357 |   // Track how many times /api/project-templates has been called.
  358 |   let callCount = 0;
  359 | 
  360 |   // The global queryClient retries 500s once automatically (failureCount 0→1,
  361 |   // then failureCount >= 1 stops it). So we need the first TWO calls to fail
  362 |   // before isError becomes true and the error state renders.
  363 |   // Third call (triggered by the user clicking Retry) succeeds.
  364 |   await page.route('**/api/project-templates', (route) => {
  365 |     callCount += 1;
  366 |     if (callCount <= 2) {
  367 |       route.fulfill({
  368 |         status: 500,
  369 |         contentType: 'application/json',
  370 |         body: JSON.stringify({ error: 'server error' }),
  371 |       });
  372 |     } else {
  373 |       route.fulfill(json([TEMPLATE]));
  374 |     }
  375 |   });
  376 | 
  377 |   await page.goto('/jobs/new', { waitUntil: 'networkidle' });
  378 | 
  379 |   // The job type picker must be visible first.
  380 |   const typePicker = page.locator('[data-testid="page-job-type-picker"]');
  381 |   await expect(typePicker).toBeVisible({ timeout: 10000 });
  382 | 
  383 |   // Select "Project" — this triggers the /api/project-templates fetch.
  384 |   await page.click('[data-testid="card-job-type-project"]');
  385 | 
  386 |   // The template picker page renders.
  387 |   const templatePicker = page.locator('[data-testid="page-template-picker"]');
  388 |   await expect(templatePicker).toBeVisible({ timeout: 10000 });
  389 | 
  390 |   // The error state must be shown after the first (failing) fetch.
  391 |   const errorState = page.locator('[data-testid="template-picker-error"]');
  392 |   await expect(errorState).toBeVisible({ timeout: 10000 });
  393 | 
  394 |   // Click Retry — this triggers the second fetch which succeeds.
  395 |   await page.click('[data-testid="button-retry-templates"]');
  396 | 
  397 |   // The error state must disappear and the template card must appear.
  398 |   await expect(errorState).not.toBeVisible({ timeout: 10000 });
  399 |   const templateBtn = page.locator(`[data-testid="button-use-template-${TEMPLATE.id}"]`);
  400 |   await expect(templateBtn).toBeVisible({ timeout: 10000 });
  401 | });
  402 | 
  403 | // ---------------------------------------------------------------------------
  404 | // Test 7 — Ops health error banner on network failure
  405 | // ---------------------------------------------------------------------------
  406 | 
  407 | test('shows ops health error banner when /api/ops/health fails', async ({ page }) => {
  408 |   await mockBaseApis(page);
  409 | 
  410 |   // Override ops/health with a 500 response (registered last = wins via LIFO).
  411 |   // We use 500 rather than route.abort() because the app's getQueryFn catches
  412 |   // 'Failed to fetch' network errors and silently returns [] instead of throwing,
  413 |   // which prevents isError from being set. A 500 HTTP response is rethrown as
  414 |   // an Error("500: ...") that TanStack Query correctly marks as isError=true.
  415 |   await page.route('**/api/ops/health', (route) =>
  416 |     route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'server error' }) })
  417 |   );
  418 | 
> 419 |   await page.goto('/dispatch-board', { waitUntil: 'networkidle' });
      |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:22128/dispatch-board
  420 | 
  421 |   // OpsHealthBanner renders this string when opsHealthError is true.
  422 |   const errorBanner = page.getByText('Ops health could not be loaded');
  423 |   await expect(errorBanner).toBeVisible({ timeout: 15000 });
  424 | });
  425 | 
```