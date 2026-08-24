# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dispatch-skeleton.spec.ts >> shows template picker skeleton while /api/project-templates is loading
- Location: e2e/dispatch-skeleton.spec.ts:306:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:22128/jobs/new
Call log:
  - navigating to "http://localhost:22128/jobs/new", waiting until "networkidle"

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
  218 | 
  219 |   // Simulate what ProjectTemplatesSettings' delete mutation does:
  220 |   //   1. Switch the mock so the next GET /api/project-templates returns [].
  221 |   //   2. Call queryClient.invalidateQueries with the same key used by onSuccess —
  222 |   //      this is the exact mechanism that keeps the picker in sync after deletion.
  223 |   // No page reload is involved: queryClient lives in the same document.
  224 |   deleted = true;
  225 |   await page.evaluate(async () => {
  226 |     // __testQueryClient is exposed by main.tsx in DEV mode.
  227 |     const qc = (window as any).__testQueryClient;
  228 |     if (!qc) throw new Error('__testQueryClient not found on window');
  229 |     await qc.invalidateQueries({ queryKey: ['/api/project-templates'] });
  230 |   });
  231 | 
  232 |   // After the invalidation-triggered refetch the deleted template must be gone.
  233 |   await expect(templateBtn).not.toBeVisible({ timeout: 10000 });
  234 | 
  235 |   // The "Start blank" fallback must still be available.
  236 |   await expect(page.locator('[data-testid="button-skip-template"]')).toBeVisible();
  237 | });
  238 | 
  239 | // ---------------------------------------------------------------------------
  240 | // Test 4 — Newly created template appears in job-creation picker without reload
  241 | // ---------------------------------------------------------------------------
  242 | 
  243 | test('newly created template appears in job-creation picker without page reload', async ({ page }) => {
  244 |   await mockBaseApis(page);
  245 | 
  246 |   const TEMPLATE = {
  247 |     id: 'tpl-create-test',
  248 |     name: 'Renovation Build',
  249 |     description: 'Standard renovation template',
  250 |     templateData: {
  251 |       phases: [
  252 |         { phaseCode: 'DEMO', name: 'Demolition' },
  253 |         { phaseCode: 'FIT', name: 'Fit-out' },
  254 |       ],
  255 |       checklistItems: [],
  256 |     },
  257 |     createdAt: new Date().toISOString(),
  258 |   };
  259 | 
  260 |   // Stateful flag: starts false (no saved templates), flipped to true to simulate creation.
  261 |   let created = false;
  262 |   await page.route('**/api/project-templates', (route) => {
  263 |     route.fulfill(json(created ? [TEMPLATE] : []));
  264 |   });
  265 | 
  266 |   // Navigate to the job creation form.
  267 |   await page.goto('/jobs/new', { waitUntil: 'networkidle' });
  268 | 
  269 |   // The job type picker must be visible.
  270 |   const typePicker = page.locator('[data-testid="page-job-type-picker"]');
  271 |   await expect(typePicker).toBeVisible({ timeout: 10000 });
  272 | 
  273 |   // Select "Project" — this enables the /api/project-templates query.
  274 |   await page.click('[data-testid="card-job-type-project"]');
  275 | 
  276 |   // Template picker renders — no saved templates yet, so only "Start blank" is visible.
  277 |   const templatePicker = page.locator('[data-testid="page-template-picker"]');
  278 |   await expect(templatePicker).toBeVisible({ timeout: 10000 });
  279 | 
  280 |   const templateBtn = page.locator('[data-testid="button-use-template-tpl-create-test"]');
  281 |   await expect(templateBtn).not.toBeVisible();
  282 | 
  283 |   // Simulate what ProjectTemplatesSettings' POST mutation does in its onSuccess:
  284 |   //   1. Switch the mock so the next GET /api/project-templates returns the new template.
  285 |   //   2. Call queryClient.invalidateQueries with the same key used by onSuccess —
  286 |   //      this is the exact mechanism that keeps the picker in sync after creation.
  287 |   // No page reload is involved: queryClient lives in the same document.
  288 |   created = true;
  289 |   await page.evaluate(async () => {
  290 |     const qc = (window as any).__testQueryClient;
  291 |     if (!qc) throw new Error('__testQueryClient not found on window');
  292 |     await qc.invalidateQueries({ queryKey: ['/api/project-templates'] });
  293 |   });
  294 | 
  295 |   // After the invalidation-triggered refetch the new template must appear.
  296 |   await expect(templateBtn).toBeVisible({ timeout: 10000 });
  297 | 
  298 |   // The "Start blank" fallback must still be available.
  299 |   await expect(page.locator('[data-testid="button-skip-template"]')).toBeVisible();
  300 | });
  301 | 
  302 | // ---------------------------------------------------------------------------
  303 | // Test 5 — Template picker skeleton while /api/project-templates is delayed
  304 | // ---------------------------------------------------------------------------
  305 | 
  306 | test('shows template picker skeleton while /api/project-templates is loading', async ({ page }) => {
  307 |   await mockBaseApis(page);
  308 | 
  309 |   // Hold the project-templates response indefinitely so the skeleton stays visible.
  310 |   let resolveTemplates!: () => void;
  311 |   const templatesHeld = new Promise<void>((res) => { resolveTemplates = res; });
  312 | 
  313 |   await page.route('**/api/project-templates', async (route: Route) => {
  314 |     await templatesHeld;
  315 |     await route.fulfill(json([]));
  316 |   });
  317 | 
> 318 |   await page.goto('/jobs/new', { waitUntil: 'networkidle' });
      |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:22128/jobs/new
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
```