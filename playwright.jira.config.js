// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright configuration for Jira-generated tests only
 */
module.exports = defineConfig({
  testDir: './tests/jira-generated',
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
      name: 'jira-generated',
      testDir: './tests/jira-generated',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
