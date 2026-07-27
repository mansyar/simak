import { defineConfig, devices } from '@playwright/test';

/**
 * E2E test environment configuration.
 * These env vars are set on process.env so globalSetup (same process) can use them.
 * The same values are also passed to webServer.env for the dev server process.
 */
const E2E_DATABASE_URL = 'postgresql://simak:simak_password@localhost:5433/simak_test';
const E2E_ENV = {
  DATABASE_URL: E2E_DATABASE_URL,
  MIGRATE_DATABASE_URL: E2E_DATABASE_URL,
  RESEND_API_KEY: 're_test_dummy_key',
  BETTER_AUTH_SECRET: 'e2e-test-secret-not-for-production-use',
  BETTER_AUTH_URL: 'http://localhost:3000',
  SUPERADMIN_EMAIL: 'superadmin@e2e.test',
  SUPERADMIN_PASSWORD: 'TestPass123!',
};

// Make env vars available to globalSetup (runs in the same process)
for (const [key, value] of Object.entries(E2E_ENV)) {
  process.env[key] = value;
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: E2E_ENV,
  },
  globalSetup: './tests/e2e/global-setup.ts',
});
