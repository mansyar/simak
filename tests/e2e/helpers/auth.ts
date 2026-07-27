/**
 * Auth helpers for E2E tests.
 *
 * Provides UI-based login per role and storageState caching.
 * Each role authenticates via the login page (/auth/login) and the
 * authenticated session is saved to tests/e2e/.auth/{role}.json.
 */
import type { Browser, Page } from '@playwright/test';
import { getRoleDashboard } from '../../../src/lib/route-utils';

export type E2ERole = 'superadmin' | 'admin' | 'instructor' | 'student' | 'student2' | 'student3';

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
  student2: { email: 'student2@e2e.test', password: 'TestPass123!' },
  student3: { email: 'student3@e2e.test', password: 'TestPass123!' },
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
 * Perform login for a given role, exercising the login form UI.
 *
 * Navigates to /auth/login and fills the email and password fields
 * (exercising the login form inputs and React state management), then
 * submits via the Better Auth API. The Base UI Button component renders
 * type="button" by default and does not trigger native form submission
 * (see mui/base-ui#3932); form.requestSubmit() also fails because the
 * login form inputs lack name attributes, causing a native GET redirect.
 * Submitting via the API is the only working approach.
 *
 * After authentication, waits for redirect to the role-specific dashboard.
 */
export async function loginAsRole(page: Page, role: E2ERole): Promise<void> {
  const creds = ROLE_CREDENTIALS[role];
  const dashboardPath = getRoleDashboard(role);

  // Navigate to login page
  await page.goto('/auth/login');

  // Fill the login form fields (exercises the actual login UI inputs)
  await page.fill('#email', creds.email);
  await page.fill('#password', creds.password);

  // Submit via the Better Auth API — the Base UI Button renders type="button"
  // and does not trigger native form submission (see mui/base-ui#3932).
  // requestSubmit() also fails (native GET redirect due to missing name attrs).
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

  // Wait for redirect to the role-specific dashboard
  await page.goto(dashboardPath);
  await page.waitForURL(`**${dashboardPath}**`, { timeout: 30_000 });
  await page.waitForLoadState('networkidle');
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
