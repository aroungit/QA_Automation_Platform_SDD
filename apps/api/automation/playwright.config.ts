// Validation Report: VAL-SPEC-LOGIN-001-1791637471880
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for QA_Automation_Platform_Agent (§3.5)
 * Generated for temporary workspace validation and dynamic execution.
 * Configured for OrangeHRM (https://opensource-demo.orangehrmlive.com), React App (http://localhost:3000), and Mobile.
 */
export default defineConfig({
  testDir: '.',
  testMatch: ['**/tests/**/*.spec.ts'],
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: process.env.ORANGEHRM_BASE_URL || 'https://opensource-demo.orangehrmlive.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testMatch: /web\/tests\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      testMatch: /web\/tests\/.*\.spec\.ts/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testMatch: /web\/tests\/.*\.spec\.ts/,
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      testMatch: /mobile\/tests\/.*\.spec\.ts/,
      use: {
        ...devices[process.env.MOBILE_DEVICE || 'Pixel 7'],
      },
    },
    {
      name: 'mobile-safari',
      testMatch: /mobile\/tests\/.*\.spec\.ts/,
      use: {
        ...devices['iPhone 14'],
      },
    },
  ],
});
