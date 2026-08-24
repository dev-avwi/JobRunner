# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dispatch-skeleton.spec.ts >> shows map skeleton while /api/dispatch/board is loading on Map tab
- Location: e2e/dispatch-skeleton.spec.ts:145:1

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
  56  | async function mockBaseApis(page: Page) {
  57  |   // Auth / session
  58  |   await page.route('**/api/auth/me', (r) => r.fulfill(json(AUTH_USER)));
  59  |   await page.route('**/api/auth/my-businesses', (r) =>
  60  |     r.fulfill(json([{ id: 1, name: 'Test Business' }]))
  61  |   );
  62  |   await page.route('**/api/team/my-role', (r) => r.fulfill({ status: 404, body: '' }));
  63  | 
  64  |   // Core settings
  65  |   await page.route('**/api/business-settings', (r) => r.fulfill(json(BUSINESS_SETTINGS)));
  66  |   await page.route('**/api/subscription/usage', (r) => r.fulfill(json(SUBSCRIPTION_USAGE)));
  67  | 
  68  |   // Dispatch board — default: immediate empty list
  69  |   await page.route('**/api/dispatch/board', (r) => r.fulfill(json([])));
  70  |   await page.route('**/api/dispatch/resources', (r) =>
  71  |     r.fulfill(json({ teamMembers: [], vehicles: [] }))
  72  |   );
  73  | 
  74  |   // Ops health — default: healthy (no issues)
  75  |   await page.route('**/api/ops/health', (r) => r.fulfill(json(OPS_HEALTH_OK)));
  76  |   await page.route('**/api/ops/job-aging', (r) =>
  77  |     r.fulfill(json({ totalAging: 0, criticalCount: 0, agingJobs: [] }))
  78  |   );
  79  | 
  80  |   // Supporting dispatch data
  81  |   await page.route('**/api/jobs', (r) => r.fulfill(json([])));
  82  |   await page.route('**/api/clients', (r) => r.fulfill(json([])));
  83  |   await page.route('**/api/team/members', (r) => r.fulfill(json([])));
  84  |   await page.route('**/api/team/worker-states', (r) => r.fulfill(json([])));
  85  |   await page.route('**/api/ai/schedule-suggestions**', (r) =>
  86  |     r.fulfill(json({ suggestions: [] }))
  87  |   );
  88  | 
  89  |   // Misc endpoints the App shell fires on mount
  90  |   await page.route('**/api/notifications/**', (r) =>
  91  |     r.fulfill(json({ notifications: [], unreadCount: 0 }))
  92  |   );
  93  |   await page.route('**/api/integrations/health', (r) =>
  94  |     r.fulfill(json({ allReady: true }))
  95  |   );
  96  | }
  97  | 
  98  | // ---------------------------------------------------------------------------
  99  | // Test 1 — Board skeleton while /api/dispatch/board is delayed
  100 | // ---------------------------------------------------------------------------
  101 | 
  102 | test('shows board skeleton while /api/dispatch/board is loading', async ({ page }) => {
  103 |   await mockBaseApis(page);
  104 | 
  105 |   // Override dispatch/board with a delayed response (registered AFTER mockBaseApis
  106 |   // so LIFO ordering means this handler takes precedence).
  107 |   let resolveBoard!: () => void;
  108 |   const boardHeld = new Promise<void>((res) => { resolveBoard = res; });
  109 | 
  110 |   await page.route('**/api/dispatch/board', async (route: Route) => {
  111 |     await boardHeld;
  112 |     await route.fulfill(json([]));
  113 |   });
  114 | 
  115 |   // Navigate directly to the dispatch board page.
  116 |   // NOTE: /dispatch redirects to /schedule — the board lives at /dispatch-board.
  117 |   // Wait for networkidle: the board query is disabled while topView==='schedule',
  118 |   // so all initial requests resolve and the app settles without touching boardHeld.
  119 |   await page.goto('/dispatch-board', { waitUntil: 'networkidle' });
  120 | 
  121 |   // Click the Board tab. Scope to the dispatch board container to avoid
  122 |   // ambiguity with any sidebar navigation buttons sharing similar names.
  123 |   const dispatchBoard = page.locator('[data-testid="dispatch-board"]');
  124 |   await expect(dispatchBoard).toBeVisible({ timeout: 10000 });
  125 |   const boardTab = dispatchBoard.getByRole('button', { name: /^board$/i });
  126 |   await expect(boardTab).toBeVisible({ timeout: 5000 });
  127 |   await boardTab.click();
  128 | 
  129 |   // While the board request is held, DispatchBoardSkeleton should render.
  130 |   const boardSkeleton = page.locator('[data-testid="dispatch-board-skeleton"]');
  131 |   await expect(boardSkeleton).toBeVisible({ timeout: 5000 });
  132 | 
  133 |   // Confirm the 4 skeleton columns are inside it.
  134 |   await expect(boardSkeleton.locator('> div')).toHaveCount(4);
  135 | 
  136 |   // Release the held request and verify the skeleton disappears.
  137 |   resolveBoard();
  138 |   await expect(boardSkeleton).not.toBeVisible({ timeout: 10000 });
  139 | });
  140 | 
  141 | // ---------------------------------------------------------------------------
  142 | // Test 2 — Map skeleton while /api/dispatch/board is delayed
  143 | // ---------------------------------------------------------------------------
  144 | 
  145 | test('shows map skeleton while /api/dispatch/board is loading on Map tab', async ({ page }) => {
  146 |   await mockBaseApis(page);
  147 | 
  148 |   let resolveBoard!: () => void;
  149 |   const boardHeld = new Promise<void>((res) => { resolveBoard = res; });
  150 | 
  151 |   await page.route('**/api/dispatch/board', async (route: Route) => {
  152 |     await boardHeld;
  153 |     await route.fulfill(json([]));
  154 |   });
  155 | 
> 156 |   await page.goto('/dispatch-board', { waitUntil: 'networkidle' });
      |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:22128/dispatch-board
  157 | 
  158 |   // Click the Map tab. Scope to the dispatch board container to avoid
  159 |   // ambiguity with any sidebar navigation buttons sharing similar names.
  160 |   const dispatchBoard = page.locator('[data-testid="dispatch-board"]');
  161 |   await expect(dispatchBoard).toBeVisible({ timeout: 10000 });
  162 |   const mapTab = dispatchBoard.getByRole('button', { name: /^map$/i });
  163 |   await expect(mapTab).toBeVisible({ timeout: 5000 });
  164 |   await mapTab.click();
  165 | 
  166 |   // DispatchMapSkeleton renders while the board request is pending.
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
```