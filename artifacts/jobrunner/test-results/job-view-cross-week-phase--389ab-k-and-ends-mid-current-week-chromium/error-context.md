# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: job-view-cross-week-phase.spec.ts >> job-view timeline renders a visible block for a phase that started in the prior week and ends mid-current-week
- Location: e2e/job-view-cross-week-phase.spec.ts:153:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:22128/dispatch?view=job&jobId=job-crossweek-1
Call log:
  - navigating to "http://localhost:22128/dispatch?view=job&jobId=job-crossweek-1", waiting until "domcontentloaded"

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
  87  |     r.fulfill(json({ notifications: [], unreadCount: 0 }))
  88  |   );
  89  |   await page.route('**/api/integrations/health', (r) =>
  90  |     r.fulfill(json({ allReady: true }))
  91  |   );
  92  | }
  93  | 
  94  | // ---------------------------------------------------------------------------
  95  | // Test fixtures
  96  | // ---------------------------------------------------------------------------
  97  | 
  98  | const WORKER = {
  99  |   id: 'w1',
  100 |   memberId: 'w1',
  101 |   firstName: 'Alex',
  102 |   lastName: 'Smith',
  103 |   email: 'alex@example.com',
  104 |   role: 'worker',
  105 |   profileImageUrl: null,
  106 |   themeColor: null,
  107 |   isActive: true,
  108 | };
  109 | 
  110 | const PROJECT_JOB = {
  111 |   id: 'job-crossweek-1',
  112 |   title: 'Cross-Week Phase Project',
  113 |   jobType: 'project',
  114 |   status: 'active',
  115 |   scheduledAt: null,
  116 |   scheduledTime: null,
  117 |   address: null,
  118 |   assignedTo: 'w1',
  119 |   assignments: [{ memberId: 'w1', isActive: true }],
  120 | };
  121 | 
  122 | /**
  123 |  * A phase that started 8 days ago (firmly in the prior week) and ends
  124 |  * 2 days from now (mid current week).  The job-view timeline should
  125 |  * render a visible block for each day of the current week that falls
  126 |  * inside this date range.
  127 |  */
  128 | function makeCrossWeekPhase() {
  129 |   const startDate = format(subDays(new Date(), 8), 'yyyy-MM-dd');
  130 |   const endDate   = format(addDays(new Date(), 2), 'yyyy-MM-dd');
  131 |   return {
  132 |     id: 'phase-crossweek-1',
  133 |     jobId: 'job-crossweek-1',
  134 |     phaseCode: 'FRAME',
  135 |     name: 'Framing',
  136 |     scheduledStart: `${startDate}T08:00:00`,
  137 |     scheduledEnd:   `${endDate}T17:00:00`,
  138 |     bookedHours: '40',
  139 |     status: 'in_progress',
  140 |     sortOrder: 1,
  141 |     assignedUserId: 'w1',
  142 |     assignedUserIds: ['w1'],
  143 |     assignedUsers: [{ id: 'w1', name: 'Alex Smith', isLead: true }],
  144 |     jobTitle: 'Cross-Week Phase Project',
  145 |     jobType: 'project',
  146 |   };
  147 | }
  148 | 
  149 | // ---------------------------------------------------------------------------
  150 | // Test — cross-week phase renders a visible block in the current week
  151 | // ---------------------------------------------------------------------------
  152 | 
  153 | test(
  154 |   'job-view timeline renders a visible block for a phase that started in the prior week and ends mid-current-week',
  155 |   async ({ page }) => {
  156 |     const CROSS_WEEK_PHASE = makeCrossWeekPhase();
  157 | 
  158 |     await mockBaseApis(page);
  159 | 
  160 |     // Serve the project job on both list and board endpoints
  161 |     await page.route('**/api/jobs', (r) => r.fulfill(json([PROJECT_JOB])));
  162 |     await page.route('**/api/dispatch/board', (r) => r.fulfill(json([PROJECT_JOB])));
  163 |     await page.route('**/api/dispatch/phases', (r) => r.fulfill(json([CROSS_WEEK_PHASE])));
  164 | 
  165 |     // Worker row for the timeline
  166 |     await page.route('**/api/team/members', (r) => r.fulfill(json([WORKER])));
  167 |     await page.route('**/api/team/worker-states', (r) => r.fulfill(json([])));
  168 | 
  169 |     // Per-job calls triggered when the job is selected in job-view mode
  170 |     await page.route(`**/api/jobs/${PROJECT_JOB.id}`, (r) => r.fulfill(json(PROJECT_JOB)));
  171 |     await page.route(`**/api/jobs/${PROJECT_JOB.id}/phases`, (r) =>
  172 |       r.fulfill(json([CROSS_WEEK_PHASE]))
  173 |     );
  174 |     await page.route(`**/api/jobs/${PROJECT_JOB.id}/materials`, (r) => r.fulfill(json([])));
  175 |     await page.route(`**/api/jobs/${PROJECT_JOB.id}/expenses`, (r) => r.fulfill(json([])));
  176 |     await page.route(`**/api/team/job-assignments/${PROJECT_JOB.id}`, (r) =>
  177 |       r.fulfill(json([]))
  178 |     );
  179 | 
  180 |     // Collect browser console errors
  181 |     const consoleErrors: string[] = [];
  182 |     page.on('console', (msg) => {
  183 |       if (msg.type() === 'error') consoleErrors.push(msg.text());
  184 |     });
  185 | 
  186 |     // Navigate to the dispatch page in job-view mode with the job pre-selected
> 187 |     await page.goto(`/dispatch?view=job&jobId=${PROJECT_JOB.id}`, {
      |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:22128/dispatch?view=job&jobId=job-crossweek-1
  188 |       waitUntil: 'domcontentloaded',
  189 |     });
  190 | 
  191 |     // The dispatch board must be visible — no white screen / crash
  192 |     await expect(page.locator('[data-testid="dispatch-board"]')).toBeVisible({ timeout: 15000 });
  193 | 
  194 |     // The cross-week phase block must appear in the current week view.
  195 |     // data-testid="job-view-phase-<id>" is rendered for every day the phase
  196 |     // is active, so at minimum one element with this id must be visible.
  197 |     await expect(
  198 |       page.locator('[data-testid="job-view-phase-phase-crossweek-1"]').first(),
  199 |     ).toBeVisible({ timeout: 10000 });
  200 | 
  201 |     // No unexpected runtime errors
  202 |     const relevantErrors = consoleErrors.filter(
  203 |       (e) =>
  204 |         !e.includes('favicon') &&
  205 |         !e.includes('net::ERR_') &&
  206 |         !e.includes('Service worker registration failed') &&
  207 |         !e.includes('Failed to load resource'),
  208 |     );
  209 |     expect(
  210 |       relevantErrors,
  211 |       `Unexpected console errors: ${relevantErrors.join('\n')}`,
  212 |     ).toHaveLength(0);
  213 |   },
  214 | );
  215 | 
```