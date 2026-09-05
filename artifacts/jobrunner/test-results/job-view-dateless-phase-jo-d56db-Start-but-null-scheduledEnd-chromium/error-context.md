# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: job-view-dateless-phase.spec.ts >> job-view timeline renders safely when a phase has scheduledStart but null scheduledEnd
- Location: e2e/job-view-dateless-phase.spec.ts:215:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:22128/dispatch?view=job&jobId=job-dateless-1
Call log:
  - navigating to "http://localhost:22128/dispatch?view=job&jobId=job-dateless-1", waiting until "domcontentloaded"

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
  136 |   jobType: 'project',
  137 | };
  138 | 
  139 | /** Phase with only scheduledStart set, scheduledEnd null. */
  140 | const PARTIAL_DATE_PHASE = {
  141 |   id: 'phase-partial-1',
  142 |   jobId: 'job-dateless-1',
  143 |   phaseCode: 'FRAME',
  144 |   name: 'Framing',
  145 |   scheduledStart: new Date().toISOString().slice(0, 10) + 'T08:00:00',
  146 |   scheduledEnd: null,
  147 |   bookedHours: '3',
  148 |   status: 'not_started',
  149 |   sortOrder: 2,
  150 |   assignedUserId: 'w1',
  151 |   assignedUserIds: ['w1'],
  152 |   assignedUsers: [{ id: 'w1', name: 'Alex Smith', isLead: true }],
  153 |   jobTitle: 'Dateless Phase Project',
  154 |   jobType: 'project',
  155 | };
  156 | 
  157 | // ---------------------------------------------------------------------------
  158 | // Test 1 — Job view renders without crashing when a phase has null dates
  159 | // ---------------------------------------------------------------------------
  160 | 
  161 | test('job-view timeline renders without errors when a phase has null scheduledStart and scheduledEnd', async ({ page }) => {
  162 |   await mockBaseApis(page);
  163 | 
  164 |   // Serve the project job on the jobs list and board
  165 |   await page.route('**/api/jobs', (r) => r.fulfill(json([PROJECT_JOB])));
  166 |   await page.route('**/api/dispatch/board', (r) => r.fulfill(json([PROJECT_JOB])));
  167 |   await page.route('**/api/dispatch/phases', (r) => r.fulfill(json([DATELESS_PHASE])));
  168 | 
  169 |   // Team members for the worker rows
  170 |   await page.route('**/api/team/members', (r) => r.fulfill(json([WORKER])));
  171 |   await page.route('**/api/team/worker-states', (r) => r.fulfill(json([])));
  172 | 
  173 |   // Per-job API calls made when a job is selected in job-view
  174 |   await page.route(`**/api/jobs/${PROJECT_JOB.id}`, (r) => r.fulfill(json(PROJECT_JOB)));
  175 |   await page.route(`**/api/jobs/${PROJECT_JOB.id}/phases`, (r) => r.fulfill(json([DATELESS_PHASE])));
  176 |   await page.route(`**/api/jobs/${PROJECT_JOB.id}/materials`, (r) => r.fulfill(json([])));
  177 |   await page.route(`**/api/jobs/${PROJECT_JOB.id}/expenses`, (r) => r.fulfill(json([])));
  178 |   await page.route(`**/api/team/job-assignments/${PROJECT_JOB.id}`, (r) => r.fulfill(json([])));
  179 | 
  180 |   // Collect browser console errors
  181 |   const consoleErrors: string[] = [];
  182 |   page.on('console', (msg) => {
  183 |     if (msg.type() === 'error') consoleErrors.push(msg.text());
  184 |   });
  185 | 
  186 |   // Navigate directly to the dispatch page in job-view mode with the job selected
  187 |   await page.goto(`/dispatch?view=job&jobId=${PROJECT_JOB.id}`, { waitUntil: 'domcontentloaded' });
  188 | 
  189 |   // Dispatch board must be visible (no white screen / full crash)
  190 |   await expect(page.locator('[data-testid="dispatch-board"]')).toBeVisible({ timeout: 15000 });
  191 | 
  192 |   // The dateless phase block must appear in the timeline (rendered as a
  193 |   // single-day block on the first day of the view — not silently hidden).
  194 |   await expect(
  195 |     page.locator('[data-testid="job-view-phase-phase-dateless-1"]'),
  196 |   ).toBeVisible({ timeout: 10000 });
  197 | 
  198 |   // No runtime errors must have been thrown.
  199 |   // Filter out pre-existing environment noise (SW registration in test runner,
  200 |   // 404s for optional resources like favicons) that are unrelated to this test.
  201 |   const relevantErrors = consoleErrors.filter(
  202 |     (e) =>
  203 |       !e.includes('favicon') &&
  204 |       !e.includes('net::ERR_') &&
  205 |       !e.includes('Service worker registration failed') &&
  206 |       !e.includes('Failed to load resource'),
  207 |   );
  208 |   expect(relevantErrors, `Unexpected console errors: ${relevantErrors.join('\n')}`).toHaveLength(0);
  209 | });
  210 | 
  211 | // ---------------------------------------------------------------------------
  212 | // Test 2 — Phase with only scheduledStart (scheduledEnd null) renders safely
  213 | // ---------------------------------------------------------------------------
  214 | 
  215 | test('job-view timeline renders safely when a phase has scheduledStart but null scheduledEnd', async ({ page }) => {
  216 |   await mockBaseApis(page);
  217 | 
  218 |   await page.route('**/api/jobs', (r) => r.fulfill(json([PROJECT_JOB])));
  219 |   await page.route('**/api/dispatch/board', (r) => r.fulfill(json([PROJECT_JOB])));
  220 |   await page.route('**/api/dispatch/phases', (r) => r.fulfill(json([PARTIAL_DATE_PHASE])));
  221 | 
  222 |   await page.route('**/api/team/members', (r) => r.fulfill(json([WORKER])));
  223 |   await page.route('**/api/team/worker-states', (r) => r.fulfill(json([])));
  224 | 
  225 |   await page.route(`**/api/jobs/${PROJECT_JOB.id}`, (r) => r.fulfill(json(PROJECT_JOB)));
  226 |   await page.route(`**/api/jobs/${PROJECT_JOB.id}/phases`, (r) => r.fulfill(json([PARTIAL_DATE_PHASE])));
  227 |   await page.route(`**/api/jobs/${PROJECT_JOB.id}/materials`, (r) => r.fulfill(json([])));
  228 |   await page.route(`**/api/jobs/${PROJECT_JOB.id}/expenses`, (r) => r.fulfill(json([])));
  229 |   await page.route(`**/api/team/job-assignments/${PROJECT_JOB.id}`, (r) => r.fulfill(json([])));
  230 | 
  231 |   const consoleErrors: string[] = [];
  232 |   page.on('console', (msg) => {
  233 |     if (msg.type() === 'error') consoleErrors.push(msg.text());
  234 |   });
  235 | 
> 236 |   await page.goto(`/dispatch?view=job&jobId=${PROJECT_JOB.id}`, { waitUntil: 'domcontentloaded' });
      |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:22128/dispatch?view=job&jobId=job-dateless-1
  237 | 
  238 |   await expect(page.locator('[data-testid="dispatch-board"]')).toBeVisible({ timeout: 15000 });
  239 | 
  240 |   // The partial-date phase block must appear as a single-day block (not hidden).
  241 |   await expect(
  242 |     page.locator('[data-testid="job-view-phase-phase-partial-1"]'),
  243 |   ).toBeVisible({ timeout: 10000 });
  244 | 
  245 |   const relevantErrors = consoleErrors.filter(
  246 |     (e) =>
  247 |       !e.includes('favicon') &&
  248 |       !e.includes('net::ERR_') &&
  249 |       !e.includes('Service worker registration failed') &&
  250 |       !e.includes('Failed to load resource'),
  251 |   );
  252 |   expect(relevantErrors, `Unexpected console errors: ${relevantErrors.join('\n')}`).toHaveLength(0);
  253 | });
  254 | 
```