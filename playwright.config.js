// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results.json' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'frontend',
      testDir: './tests/frontend',
      metadata: { category: 'Frontend' },
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'backend',
      testDir: './tests/backend',
      metadata: { category: 'Backend' },
      use: {
        baseURL: process.env.BASE_URL || 'http://localhost:8000',
        trace: 'retain-on-failure',
        screenshot: 'off',
        video: 'off',
      },
    },
  ],
});
