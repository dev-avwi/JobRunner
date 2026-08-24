# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dispatch-skeleton.spec.ts >> newly created template appears in job-creation picker without page reload
- Location: e2e/dispatch-skeleton.spec.ts:243:1

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
  167 |   const mapSkeleton = page.locator('[data-testid="dispatch-map-skeleton"]');
  168 |   await expect(mapSkeleton).toBeVisible({ timeout: 5000 });
  169 | 
  170 |   resolveBoard();
  171 |   await expect(mapSkeleton).not.toBeVisible({ timeout: 10000 });
  172 | });
  173 | 
  174 | // ---------------------------------------------------------------------------
  175 | // Test 3 — Deleted template absent from job-creation picker without reload
  176 | // ---------------------------------------------------------------------------
  177 | 
  178 | test('deleted template is absent from job-creation picker without page reload', async ({ page }) => {
  179 |   await mockBaseApis(page);
  180 | 
  181 |   const TEMPLATE = {
  182 |     id: 'tpl-del-test',
  183 |     name: 'House Build',
  184 |     description: 'Standard house build template',
  185 |     templateData: {
  186 |       phases: [
  187 |         { phaseCode: 'FOUND', name: 'Foundation' },
  188 |         { phaseCode: 'FRAME', name: 'Framing' },
  189 |       ],
  190 |       checklistItems: [],
  191 |     },
  192 |     createdAt: new Date().toISOString(),
  193 |   };
  194 | 
  195 |   // Stateful flag: starts false, flipped to true to simulate deletion.
  196 |   // The mock returns the template before deletion and an empty list after.
  197 |   let deleted = false;
  198 |   await page.route('**/api/project-templates', (route) => {
  199 |     route.fulfill(json(deleted ? [] : [TEMPLATE]));
  200 |   });
  201 | 
  202 |   // Navigate to the job creation form.
  203 |   await page.goto('/jobs/new', { waitUntil: 'networkidle' });
  204 | 
  205 |   // The job type picker must be visible.
  206 |   const typePicker = page.locator('[data-testid="page-job-type-picker"]');
  207 |   await expect(typePicker).toBeVisible({ timeout: 10000 });
  208 | 
  209 |   // Select "Project" — this enables the /api/project-templates query.
  210 |   await page.click('[data-testid="card-job-type-project"]');
  211 | 
  212 |   // Template picker renders and the saved template is shown.
  213 |   const templatePicker = page.locator('[data-testid="page-template-picker"]');
  214 |   await expect(templatePicker).toBeVisible({ timeout: 10000 });
  215 | 
  216 |   const templateBtn = page.locator('[data-testid="button-use-template-tpl-del-test"]');
  217 |   await expect(templateBtn).toBeVisible({ timeout: 5000 });
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
> 267 |   await page.goto('/jobs/new', { waitUntil: 'networkidle' });
      |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:22128/jobs/new
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
  318 |   await page.goto('/jobs/new', { waitUntil: 'networkidle' });
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
```