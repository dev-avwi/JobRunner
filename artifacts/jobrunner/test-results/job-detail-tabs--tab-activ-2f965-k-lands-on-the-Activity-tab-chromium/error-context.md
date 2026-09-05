# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: job-detail-tabs.spec.ts >> ?tab=activity deep link lands on the Activity tab
- Location: e2e/job-detail-tabs.spec.ts:230:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:22128/jobs/sc-1?tab=activity
Call log:
  - navigating to "http://localhost:22128/jobs/sc-1?tab=activity", waiting until "networkidle"

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
  134 |  */
  135 | async function mockJobDetailApis(
  136 |   page: Page,
  137 |   job: typeof SERVICE_CALL_JOB | typeof PROJECT_JOB,
  138 |   options: { phases?: typeof PHASES } = {}
  139 | ) {
  140 |   const id = job.id;
  141 | 
  142 |   // Job detail
  143 |   await page.route(`**/api/jobs/${id}`, (r) => r.fulfill(json(job)));
  144 | 
  145 |   // Client
  146 |   await page.route(`**/api/clients/${job.clientId}`, (r) => r.fulfill(json(CLIENT)));
  147 | 
  148 |   // Explicit-queryFn subroutes (fetch() calls with full URL paths)
  149 |   await page.route(`**/api/jobs/${id}/linked-documents`, (r) =>
  150 |     r.fulfill(json(EMPTY_LINKED_DOCS))
  151 |   );
  152 |   await page.route(`**/api/jobs/${id}/assignments`, (r) => r.fulfill(json([])));
  153 |   await page.route(`**/api/jobs/${id}/activity**`, (r) => r.fulfill(json([])));
  154 | 
  155 |   // Default-queryFn subroutes (keyed, no explicit queryFn)
  156 |   await page.route(`**/api/jobs/${id}/materials`, (r) => r.fulfill(json([])));
  157 |   await page.route(`**/api/jobs/${id}/variations`, (r) => r.fulfill(json([])));
  158 |   await page.route(`**/api/jobs/${id}/profitability`, (r) =>
  159 |     r.fulfill(json({ profit: { isNegative: false, margin: 0 } }))
  160 |   );
  161 |   await page.route(`**/api/jobs/${id}/photos`, (r) => r.fulfill(json([])));
  162 |   await page.route(`**/api/jobs/${id}/notes`, (r) => r.fulfill(json([])));
  163 |   await page.route(`**/api/jobs/${id}/voice-notes`, (r) => r.fulfill(json([])));
  164 |   await page.route(`**/api/jobs/${id}/signatures`, (r) => r.fulfill(json([])));
  165 |   await page.route(`**/api/jobs/${id}/equipment`, (r) => r.fulfill(json([])));
  166 | 
  167 |   // Project-only endpoints
  168 |   await page.route(`**/api/jobs/${id}/phases`, (r) =>
  169 |     r.fulfill(json(options.phases ?? []))
  170 |   );
  171 |   await page.route(`**/api/jobs/${id}/defect-items`, (r) => r.fulfill(json([])));
  172 | 
  173 |   // Portal URL endpoint (optional; 404 is safe here)
  174 |   await page.route(`**/api/clients/${job.clientId}/portal-url`, (r) =>
  175 |     r.fulfill({ status: 404, body: '' })
  176 |   );
  177 | }
  178 | 
  179 | // ---------------------------------------------------------------------------
  180 | // Test 1 — Service call renders the correct tab strip (no Phases tab)
  181 | // ---------------------------------------------------------------------------
  182 | 
  183 | test('service call renders tab strip without a Phases tab', async ({ page }) => {
  184 |   await mockBaseApis(page);
  185 |   await mockJobDetailApis(page, SERVICE_CALL_JOB);
  186 | 
  187 |   await page.goto(`/jobs/${SERVICE_CALL_JOB.id}`, { waitUntil: 'networkidle' });
  188 | 
  189 |   const view = page.locator('[data-testid="job-detail-view"]');
  190 |   await expect(view).toBeVisible({ timeout: 15000 });
  191 | 
  192 |   const strip = page.locator('[data-testid="tab-strip"]');
  193 |   await expect(strip).toBeVisible({ timeout: 10000 });
  194 | 
  195 |   // Expected tabs
  196 |   for (const tab of ['tab-overview', 'tab-activity', 'tab-financials', 'tab-docs', 'tab-chat']) {
  197 |     await expect(page.locator(`[data-testid="${tab}"]`)).toBeVisible();
  198 |   }
  199 | 
  200 |   // Phases tab must NOT appear on a service call
  201 |   await expect(page.locator('[data-testid="tab-phases"]')).not.toBeVisible();
  202 | });
  203 | 
  204 | // ---------------------------------------------------------------------------
  205 | // Test 2 — Project renders the correct tab strip (includes Phases tab)
  206 | // ---------------------------------------------------------------------------
  207 | 
  208 | test('project renders tab strip with a Phases tab', async ({ page }) => {
  209 |   await mockBaseApis(page);
  210 |   await mockJobDetailApis(page, PROJECT_JOB, { phases: PHASES });
  211 | 
  212 |   await page.goto(`/jobs/${PROJECT_JOB.id}`, { waitUntil: 'networkidle' });
  213 | 
  214 |   const view = page.locator('[data-testid="job-detail-view"]');
  215 |   await expect(view).toBeVisible({ timeout: 15000 });
  216 | 
  217 |   const strip = page.locator('[data-testid="tab-strip"]');
  218 |   await expect(strip).toBeVisible({ timeout: 10000 });
  219 | 
  220 |   // All six tabs including Phases
  221 |   for (const tab of ['tab-overview', 'tab-phases', 'tab-activity', 'tab-financials', 'tab-docs', 'tab-chat']) {
  222 |     await expect(page.locator(`[data-testid="${tab}"]`)).toBeVisible();
  223 |   }
  224 | });
  225 | 
  226 | // ---------------------------------------------------------------------------
  227 | // Test 3 — ?tab=activity deep link activates the Activity tab
  228 | // ---------------------------------------------------------------------------
  229 | 
  230 | test('?tab=activity deep link lands on the Activity tab', async ({ page }) => {
  231 |   await mockBaseApis(page);
  232 |   await mockJobDetailApis(page, SERVICE_CALL_JOB);
  233 | 
> 234 |   await page.goto(`/jobs/${SERVICE_CALL_JOB.id}?tab=activity`, { waitUntil: 'networkidle' });
      |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:22128/jobs/sc-1?tab=activity
  235 | 
  236 |   await expect(page.locator('[data-testid="job-detail-view"]')).toBeVisible({ timeout: 15000 });
  237 | 
  238 |   // Activity tab must be active; Overview must not
  239 |   await expect(page.locator('[data-testid="tab-activity"][data-state="active"]')).toBeVisible({ timeout: 10000 });
  240 |   await expect(page.locator('[data-testid="tab-overview"][data-state="active"]')).not.toBeVisible();
  241 | });
  242 | 
  243 | // ---------------------------------------------------------------------------
  244 | // Test 4 — ?tab=financials deep link activates the Financials tab
  245 | // ---------------------------------------------------------------------------
  246 | 
  247 | test('?tab=financials deep link lands on the Financials tab', async ({ page }) => {
  248 |   await mockBaseApis(page);
  249 |   await mockJobDetailApis(page, PROJECT_JOB, { phases: PHASES });
  250 | 
  251 |   await page.goto(`/jobs/${PROJECT_JOB.id}?tab=financials`, { waitUntil: 'networkidle' });
  252 | 
  253 |   await expect(page.locator('[data-testid="job-detail-view"]')).toBeVisible({ timeout: 15000 });
  254 | 
  255 |   await expect(page.locator('[data-testid="tab-financials"][data-state="active"]')).toBeVisible({ timeout: 10000 });
  256 |   await expect(page.locator('[data-testid="tab-overview"][data-state="active"]')).not.toBeVisible();
  257 | });
  258 | 
  259 | // ---------------------------------------------------------------------------
  260 | // Test 5 — ?tab=claims on a project maps to the Phases tab
  261 | // ---------------------------------------------------------------------------
  262 | 
  263 | test('?tab=claims on a project resolves to the Phases tab', async ({ page }) => {
  264 |   await mockBaseApis(page);
  265 |   await mockJobDetailApis(page, PROJECT_JOB, { phases: PHASES });
  266 | 
  267 |   await page.goto(`/jobs/${PROJECT_JOB.id}?tab=claims`, { waitUntil: 'networkidle' });
  268 | 
  269 |   await expect(page.locator('[data-testid="job-detail-view"]')).toBeVisible({ timeout: 15000 });
  270 | 
  271 |   // ?tab=claims → 'phases' for a project
  272 |   await expect(page.locator('[data-testid="tab-phases"][data-state="active"]')).toBeVisible({ timeout: 10000 });
  273 | });
  274 | 
  275 | // ---------------------------------------------------------------------------
  276 | // Test 6 — ?tab=claims on a service call falls back to Overview
  277 | // ---------------------------------------------------------------------------
  278 | 
  279 | test('?tab=claims on a service call falls back to the Overview tab', async ({ page }) => {
  280 |   await mockBaseApis(page);
  281 |   await mockJobDetailApis(page, SERVICE_CALL_JOB);
  282 | 
  283 |   await page.goto(`/jobs/${SERVICE_CALL_JOB.id}?tab=claims`, { waitUntil: 'networkidle' });
  284 | 
  285 |   await expect(page.locator('[data-testid="job-detail-view"]')).toBeVisible({ timeout: 15000 });
  286 | 
  287 |   // ?tab=claims on a service call → 'overview'
  288 |   await expect(page.locator('[data-testid="tab-overview"][data-state="active"]')).toBeVisible({ timeout: 10000 });
  289 |   await expect(page.locator('[data-testid="tab-phases"]')).not.toBeVisible();
  290 | });
  291 | 
  292 | // ---------------------------------------------------------------------------
  293 | // Test 7 — Status stepper appears for a service call
  294 | // ---------------------------------------------------------------------------
  295 | 
  296 | test('status stepper is visible for a scheduled service call', async ({ page }) => {
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
```