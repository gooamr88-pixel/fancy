// @ts-check
const { defineConfig, devices } = require('@playwright/test');
require('dotenv').config(); // loads e2e/.env if present

/**
 * Cross-browser + mobile matrix for Fancy RSVP.
 * Tasks covered: 10 (cross-browser), 11 (mobile responsive), 15 (smoke), 20 (E2E).
 *
 * BASE_URL points at the running frontend (default: local dev server).
 * Run `npm run test:smoke` for the fast post-deploy smoke subset (@smoke tagged).
 */
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CI = !!process.env.CI;

module.exports = defineConfig({
  testDir: './tests',
  // Fail the build if test.only is committed; sensible parallelism + retries.
  forbidOnly: CI,
  fullyParallel: true,
  retries: CI ? 2 : 0,
  workers: CI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  // Rich artifacts for triage; cheap on green runs (only kept on failure/retry).
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ...(CI ? [['github']] : []),
  ],

  use: {
    baseURL: BASE_URL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    testIdAttribute: 'data-testid',
  },

  // ─── Cross-browser & mobile matrix ───
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Desktop Safari', // WebKit engine (Safari)
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome', // Android (Pixel 5)
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari', // iPhone (iOS WebKit)
      use: { ...devices['iPhone 13'] },
    },
  ],

  // Optionally let Playwright boot the frontend for local runs. Uncomment to use.
  // webServer: {
  //   command: 'npm --prefix ../frontend run dev',
  //   url: BASE_URL,
  //   reuseExistingServer: !CI,
  //   timeout: 120_000,
  // },
});
