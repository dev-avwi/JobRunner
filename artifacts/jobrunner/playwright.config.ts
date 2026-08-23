import { defineConfig, devices } from '@playwright/test';

const port = process.env.PORT ? Number(process.env.PORT) : 5173;

// Use the NixOS system Chromium when the bundled shell binary is unavailable
// (it lacks the glibc shims that the Replit NixOS sandbox requires).
const SYSTEM_CHROMIUM = '/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry',
    // Block service workers so Playwright route handlers intercept all API
    // requests directly instead of having the SW fetch on the page's behalf
    // (SW-originated fetches bypass page.route() interception).
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: SYSTEM_CHROMIUM,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
      },
    },
  ],
  // Do not start a dev server — the jobrunner workflow must already be running.
});
