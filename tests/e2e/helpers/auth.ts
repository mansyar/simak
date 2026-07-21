/**
 * Auth helpers for E2E tests.
 *
 * Provides UI-based login per role and storageState caching.
 * Each role authenticates via the login page (/auth/login) and the
 * authenticated session is saved to tests/e2e/.auth/{role}.json.
 */
import type { Browser, Page } from '@playwright/test';
import { getRoleDashboard } from '../../../src/lib/route-utils';

export type E2ERole = 'superadmin' | 'admin' | 'instructor' | 'student';

/**
 * Login credentials for each E2E role.
 * All passwords are TestPass123! — set by scripts/seed-e2e.ts.
 */
export const ROLE_CREDENTIALS: Record<E2ERole, { email: string; password: string }> = {
  superadmin: {
    email: process.env.SUPERADMIN_EMAIL || 'superadmin@e2e.test',
    password: process.env.SUPERADMIN_PASSWORD || 'TestPass123!',
  },
  admin: { email: 'admin@e2e.test', password: 'TestPass123!' },
  instructor: { email: 'instructor@e2e.test', password: 'TestPass123!' },
  student: { email: 'student@e2e.test', password: 'TestPass123!' },
};

/**
 * Directory where authenticated session files are stored.
 * This directory is gitignored.
 */
export const AUTH_DIR = 'tests/e2e/.auth';

/**
 * Get the storageState file path for a given role.
 */
export function getAuthFilePath(role: E2ERole): string {
  return `${AUTH_DIR}/${role}.json`;
}

/**
 * Perform UI-based login for a given role.
 *
 * Navigates to /auth/login, fills credentials, submits, and waits
 * for redirect to the role-specific dashboard.
 */
export async function loginAsRole(page: Page, role: E2ERole): Promise<void> {
  const creds = ROLE_CREDENTIALS[role];
  const dashboardPath = getRoleDashboard(role);

  await page.goto('/auth/login');

  // Fill login form
  await page.locator('#email').fill(creds.email);
  await page.locator('#password').fill(creds.password);

  // Submit and wait for dashboard redirect
  await Promise.all([
    page.waitForURL(`**${dashboardPath}**`, { timeout: 30_000 }),
    page.locator('button[type="submit"]').click(),
  ]);
}

/**
 * Ensure an authenticated storageState file exists for the given role.
 *
 * Creates a fresh browser context, logs in via the UI, saves the
 * storageState to tests/e2e/.auth/{role}.json, and closes the context.
 *
 * Call this in a spec file's beforeAll hook after resetDatabase().
 */
export async function ensureAuthFile(browser: Browser, role: E2ERole): Promise<void> {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await loginAsRole(page, role);
    await context.storageState({ path: getAuthFilePath(role) });
  } finally {
    await context.close();
  }
}
