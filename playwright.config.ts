import { defineConfig, devices } from '@playwright/test';

// Mobile device viewports for testing
const MOBILE_VIEWPORT = { width: 390, height: 844 }; // iPhone 14 Pro
const TABLET_VIEWPORT = { width: 768, height: 1024 }; // iPad

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for Expo web compatibility
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:8081',
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: MOBILE_VIEWPORT,
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],

  // Playwright owns the server.
  //
  // This used to say "no webServer — we start Expo manually for better
  // control", and the manual path was `expo start --web &` plus a port check.
  // The port answers before Metro has built the first bundle, so every spec
  // raced the bundler and died with `net::ERR_ABORTED`. The job was marked
  // continue-on-error and then failed on every run for months.
  //
  // Two changes fix it. First, serve the STATIC EXPORT rather than the dev
  // server: there is no bundler to race, and it is byte-for-byte what Vercel
  // deploys, so a green run means the shipped build works. Second, let
  // Playwright manage the process — it waits on a real response and, unlike a
  // backgrounded shell job, tears the server down afterwards instead of
  // hanging the run.
  //
  // `dist/` must exist first: `npm run e2e` builds it, or run
  // `npx expo export -p web` yourself.
  webServer: {
    command: 'npx serve dist -l 8081 --no-clipboard',
    url: 'http://localhost:8081',
    // Locally, reuse a server you already have running. In CI always start a
    // fresh one so a stale process can never serve a stale build.
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
