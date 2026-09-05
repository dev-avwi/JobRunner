# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: week-view-dateless-phase.spec.ts >> week-view grid renders without errors when date-less and dated phases coexist
- Location: e2e/week-view-dateless-phase.spec.ts:240:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:22128/dispatch?view=week
Call log:
  - navigating to "http://localhost:22128/dispatch?view=week", waiting until "domcontentloaded"

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
  157 | 
  158 |   // Provide a worker so the week-view worker rows render
  159 |   await page.route('**/api/team/members', (r) => r.fulfill(json([WORKER])));
  160 |   await page.route('**/api/team/worker-states', (r) => r.fulfill(json([])));
  161 | 
  162 |   // Collect browser console errors
  163 |   const consoleErrors: string[] = [];
  164 |   page.on('console', (msg) => {
  165 |     if (msg.type() === 'error') consoleErrors.push(msg.text());
  166 |   });
  167 | 
  168 |   // Navigate to the dispatch page in week view
  169 |   await page.goto('/dispatch?view=week', { waitUntil: 'domcontentloaded' });
  170 | 
  171 |   // The dispatch board must be visible (no white screen / full crash)
  172 |   await expect(page.locator('[data-testid="dispatch-board"]')).toBeVisible({ timeout: 15000 });
  173 | 
  174 |   // A worker row must be present, confirming WeekView actually rendered
  175 |   await expect(page.getByText('Jordan Lee').first()).toBeVisible({ timeout: 10000 });
  176 | 
  177 |   // A date-less phase must NOT produce a week-phase chip — phaseOnDate returns
  178 |   // false for null scheduledStart, so it is silently skipped rather than crashing.
  179 |   await expect(
  180 |     page.locator('[data-testid="week-phase-week-dateless-phase-1"]'),
  181 |   ).toHaveCount(0);
  182 | 
  183 |   // No runtime errors must have been thrown.
  184 |   const relevantErrors = consoleErrors.filter(
  185 |     (e) =>
  186 |       !e.includes('favicon') &&
  187 |       !e.includes('net::ERR_') &&
  188 |       !e.includes('Service worker registration failed') &&
  189 |       !e.includes('Failed to load resource'),
  190 |   );
  191 |   expect(relevantErrors, `Unexpected console errors: ${relevantErrors.join('\n')}`).toHaveLength(0);
  192 | });
  193 | 
  194 | // ---------------------------------------------------------------------------
  195 | // Test 2 — Week view renders safely when scheduledEnd is null but start is set
  196 | // ---------------------------------------------------------------------------
  197 | 
  198 | test('week-view grid renders safely when a phase has scheduledStart but null scheduledEnd', async ({ page }) => {
  199 |   await mockBaseApis(page);
  200 | 
  201 |   // Provide the partial-date phase via /dispatch/phases
  202 |   await page.route('**/api/dispatch/phases', (r) => r.fulfill(json([PARTIAL_DATE_PHASE])));
  203 | 
  204 |   // Provide a worker so the week-view worker rows render
  205 |   await page.route('**/api/team/members', (r) => r.fulfill(json([WORKER])));
  206 |   await page.route('**/api/team/worker-states', (r) => r.fulfill(json([])));
  207 | 
  208 |   const consoleErrors: string[] = [];
  209 |   page.on('console', (msg) => {
  210 |     if (msg.type() === 'error') consoleErrors.push(msg.text());
  211 |   });
  212 | 
  213 |   await page.goto('/dispatch?view=week', { waitUntil: 'domcontentloaded' });
  214 | 
  215 |   // Board must be visible
  216 |   await expect(page.locator('[data-testid="dispatch-board"]')).toBeVisible({ timeout: 15000 });
  217 | 
  218 |   // Worker row must be visible, confirming WeekView rendered
  219 |   await expect(page.getByText('Jordan Lee').first()).toBeVisible({ timeout: 10000 });
  220 | 
  221 |   // A phase with only scheduledStart set (scheduledEnd null) renders as a
  222 |   // single-day chip on its start day — the week-phase element should appear
  223 |   // in the current week if today falls within the week shown.
  224 |   // We don't assert its presence here (depends on current week), but we do
  225 |   // assert that whatever happens, there are no runtime errors.
  226 |   const relevantErrors = consoleErrors.filter(
  227 |     (e) =>
  228 |       !e.includes('favicon') &&
  229 |       !e.includes('net::ERR_') &&
  230 |       !e.includes('Service worker registration failed') &&
  231 |       !e.includes('Failed to load resource'),
  232 |   );
  233 |   expect(relevantErrors, `Unexpected console errors: ${relevantErrors.join('\n')}`).toHaveLength(0);
  234 | });
  235 | 
  236 | // ---------------------------------------------------------------------------
  237 | // Test 3 — Week view renders safely when both date-less and dated phases coexist
  238 | // ---------------------------------------------------------------------------
  239 | 
  240 | test('week-view grid renders without errors when date-less and dated phases coexist', async ({ page }) => {
  241 |   await mockBaseApis(page);
  242 | 
  243 |   // Both phases present simultaneously — the dateless one should be silently
  244 |   // skipped without poisoning the render of the dated one.
  245 |   await page.route('**/api/dispatch/phases', (r) =>
  246 |     r.fulfill(json([DATELESS_PHASE, PARTIAL_DATE_PHASE]))
  247 |   );
  248 | 
  249 |   await page.route('**/api/team/members', (r) => r.fulfill(json([WORKER])));
  250 |   await page.route('**/api/team/worker-states', (r) => r.fulfill(json([])));
  251 | 
  252 |   const consoleErrors: string[] = [];
  253 |   page.on('console', (msg) => {
  254 |     if (msg.type() === 'error') consoleErrors.push(msg.text());
  255 |   });
  256 | 
> 257 |   await page.goto('/dispatch?view=week', { waitUntil: 'domcontentloaded' });
      |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:22128/dispatch?view=week
  258 | 
  259 |   await expect(page.locator('[data-testid="dispatch-board"]')).toBeVisible({ timeout: 15000 });
  260 | 
  261 |   // Worker row present
  262 |   await expect(page.getByText('Jordan Lee').first()).toBeVisible({ timeout: 10000 });
  263 | 
  264 |   // The fully date-less phase chip must not appear (silently filtered)
  265 |   await expect(
  266 |     page.locator('[data-testid="week-phase-week-dateless-phase-1"]'),
  267 |   ).toHaveCount(0);
  268 | 
  269 |   // No runtime errors
  270 |   const relevantErrors = consoleErrors.filter(
  271 |     (e) =>
  272 |       !e.includes('favicon') &&
  273 |       !e.includes('net::ERR_') &&
  274 |       !e.includes('Service worker registration failed') &&
  275 |       !e.includes('Failed to load resource'),
  276 |   );
  277 |   expect(relevantErrors, `Unexpected console errors: ${relevantErrors.join('\n')}`).toHaveLength(0);
  278 | });
  279 | 
```