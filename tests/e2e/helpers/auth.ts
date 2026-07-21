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
 * Perform login for a given role via the Better Auth API.
 *
 * Navigates to /auth/login (to establish origin), then calls the auth
 * API directly via fetch() to set the session cookie. This bypasses
 * the Base UI Button component, which defaults to type="button" and
 * does not trigger native form submission (see mui/base-ui#3932).
 *
 * After authentication, navigates to the role-specific dashboard.
 */
export async function loginAsRole(page: Page, role: E2ERole): Promise<void> {
  const creds = ROLE_CREDENTIALS[role];
  const dashboardPath = getRoleDashboard(role);

  // Navigate to login page to establish origin
  await page.goto('/auth/login');

  // Call the Better Auth sign-in API directly via fetch
  // This sets the session cookie via Set-Cookie header
  const response = await page.evaluate(async (credentials) => {
    const res = await fetch('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(credentials),
    });
    return { ok: res.ok, status: res.status };
  }, creds);

  if (!response.ok) {
    throw new Error(`Login failed for ${role}: API returned ${response.status}`);
  }

  // Navigate to dashboard to verify session is active
  await page.goto(dashboardPath);
  await page.waitForURL(`**${dashboardPath}**`, { timeout: 30_000 });
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
