# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: help-center-stale-session.spec.ts >> Help Center – stale session detection >> does NOT show a stale-session notice when the stored conversation is from the same route
- Location: e2e/help-center-stale-session.spec.ts:208:3

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:22128/
Call log:
  - navigating to "http://localhost:22128/", waiting until "networkidle"

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
  112 | async function openHelpCenter(page: Page) {
  113 |   await page.locator('[data-testid="button-help"]').click();
  114 |   await expect(page.locator('[data-testid="help-center-panel"]')).toBeVisible({ timeout: 10_000 });
  115 | }
  116 | 
  117 | /** Close the Help Center panel by pressing Escape. */
  118 | async function closeHelpCenter(page: Page) {
  119 |   await page.keyboard.press('Escape');
  120 |   await expect(page.locator('[data-testid="help-center-panel"]')).not.toBeVisible({
  121 |     timeout: 5_000,
  122 |   });
  123 | }
  124 | 
  125 | // ---------------------------------------------------------------------------
  126 | // Tests
  127 | // ---------------------------------------------------------------------------
  128 | 
  129 | test.describe('Help Center – stale session detection', () => {
  130 |   test('reopening on a different route clears the pre-fill query from a previous session', async ({
  131 |     page,
  132 |   }) => {
  133 |     await mockBaseApis(page);
  134 |     await page.goto('/', { waitUntil: 'networkidle' });
  135 | 
  136 |     // 1. Open Help Center and trigger the "Ask the Help Assistant" pre-fill
  137 |     await openHelpCenter(page);
  138 | 
  139 |     const searchInput = page.locator('[data-testid="help-search-input"]');
  140 |     await expect(searchInput).toBeVisible({ timeout: 10_000 });
  141 | 
  142 |     const searchQuery = 'xyzzy-no-match-unique-12345';
  143 |     await searchInput.fill(searchQuery);
  144 | 
  145 |     const assistantBtn = page.locator('[data-testid="help-ask-assistant-btn"]');
  146 |     await expect(assistantBtn).toBeVisible({ timeout: 5_000 });
  147 |     await assistantBtn.click();
  148 | 
  149 |     // The chat input should now be pre-filled with the search query
  150 |     const chatInput = page.locator('[data-testid="help-chat-input"]');
  151 |     await expect(chatInput).toBeVisible({ timeout: 5_000 });
  152 |     await expect(chatInput).toHaveValue(searchQuery);
  153 | 
  154 |     // 2. Close the panel
  155 |     await closeHelpCenter(page);
  156 | 
  157 |     // 3. Simulate navigating to a different route (client-side)
  158 |     await page.evaluate(() => {
  159 |       window.history.pushState({}, '', '/jobs');
  160 |     });
  161 | 
  162 |     // 4. Reopen the panel
  163 |     await openHelpCenter(page);
  164 | 
  165 |     // The panel opens back on the Articles tab — switch to Chat
  166 |     await page.locator('[data-testid="help-tab-chat"]').click();
  167 | 
  168 |     // 5. The pre-fill must NOT carry forward to the chat input
  169 |     await expect(chatInput).toBeVisible({ timeout: 5_000 });
  170 |     await expect(chatInput).toHaveValue('');
  171 |   });
  172 | 
  173 |   test('shows a stale-session notice when the stored conversation is from a different route', async ({
  174 |     page,
  175 |   }) => {
  176 |     await mockBaseApis(page);
  177 |     await page.goto('/', { waitUntil: 'networkidle' });
  178 | 
  179 |     // Pre-populate sessionStorage with a conversation from a different route
  180 |     await page.evaluate(() => {
  181 |       sessionStorage.setItem(
  182 |         'help_chat_history',
  183 |         JSON.stringify({
  184 |           route: '/jobs',
  185 |           messages: [
  186 |             { role: 'user', content: 'How do I assign a team member?' },
  187 |             { role: 'assistant', content: 'Go to the job and click Assign...' },
  188 |           ],
  189 |         })
  190 |       );
  191 |     });
  192 | 
  193 |     // Simulate being on a different route from the stored one
  194 |     await page.evaluate(() => {
  195 |       window.history.pushState({}, '', '/settings');
  196 |     });
  197 | 
  198 |     // Open the Help Center and switch to the chat tab
  199 |     await openHelpCenter(page);
  200 |     await page.locator('[data-testid="help-tab-chat"]').click();
  201 | 
  202 |     // The stale-session notice must be visible
  203 |     await expect(page.locator('[data-testid="help-chat-stale-session-notice"]')).toBeVisible({
  204 |       timeout: 5_000,
  205 |     });
  206 |   });
  207 | 
  208 |   test('does NOT show a stale-session notice when the stored conversation is from the same route', async ({
  209 |     page,
  210 |   }) => {
  211 |     await mockBaseApis(page);
> 212 |     await page.goto('/', { waitUntil: 'networkidle' });
      |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:22128/
  213 | 
  214 |     // Pre-populate sessionStorage with a conversation from the SAME route
  215 |     await page.evaluate(() => {
  216 |       sessionStorage.setItem(
  217 |         'help_chat_history',
  218 |         JSON.stringify({
  219 |           route: '/',
  220 |           messages: [
  221 |             { role: 'user', content: 'How do I create a job?' },
  222 |             { role: 'assistant', content: 'Click the New Job button...' },
  223 |           ],
  224 |         })
  225 |       );
  226 |     });
  227 | 
  228 |     // Open the Help Center and switch to the chat tab
  229 |     await openHelpCenter(page);
  230 |     await page.locator('[data-testid="help-tab-chat"]').click();
  231 | 
  232 |     // No stale-session notice should appear
  233 |     await expect(page.locator('[data-testid="help-chat-stale-session-notice"]')).not.toBeVisible();
  234 |   });
  235 | });
  236 | 
```