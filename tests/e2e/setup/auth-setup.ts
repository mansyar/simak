/**
 * Auth setup module for E2E tests.
 *
 * Provides a helper to authenticate one or more roles via the UI and
 * save storageState files. Call this from a spec file's beforeAll hook
 * after resetDatabase() to ensure authenticated sessions are available.
 */
import type { Browser } from '@playwright/test';
import { ensureAuthFile, type E2ERole } from '../helpers/auth';

/**
 * Authenticate the specified roles and save storageState files.
 *
 * Each role gets its own browser context, logs in via the UI, and
 * saves the session to tests/e2e/.auth/{role}.json.
 *
 * @example
 * // In a spec file's beforeAll:
 * test.beforeAll(async ({ browser }) => {
 *   await resetDatabase();
 *   await setupRoles(browser, ['admin', 'student']);
 * });
 */
export async function setupRoles(browser: Browser, roles: E2ERole[]): Promise<void> {
  for (const role of roles) {
    await ensureAuthFile(browser, role);
  }
}
