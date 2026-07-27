import { test, expect, type Page } from '@playwright/test';
import { ensureAuthFile, getAuthFilePath } from './helpers/auth';
import { resetDatabase } from './helpers/db-reset';

/**
 * Captures console errors and uncaught page errors during navigation.
 * Network resource loading failures (favicon, sourcemaps) are filtered out
 * as they are not application-level errors.
 */
function captureConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => {
    errors.push(`PageError: ${err.message}`);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('Failed to load resource') && !text.includes('favicon')) {
        errors.push(`Console: ${text}`);
      }
    }
  });
  return errors;
}

test.describe('Role Dashboard Smoke Tests', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    await resetDatabase();
  });

  // ─── Student Dashboard ───────────────────────────────────────────

  test.describe('Student Dashboard', () => {
    test.beforeAll(async ({ browser }) => {
      await ensureAuthFile(browser, 'student');
    });
    test.use({ storageState: getAuthFilePath('student') });

    test('loads with 4 widgets and seed data', async ({ page }) => {
      const consoleErrors = captureConsoleErrors(page);

      await page.goto('/student/dashboard');
      await page.waitForLoadState('networkidle');

      // Page title
      await expect(page.locator('h1')).toHaveText('Dashboard');

      // 4 widget cards (exact match to avoid matching empty-state text)
      await expect(page.getByText('Active Assignments', { exact: true })).toBeVisible();
      await expect(page.getByText('Upcoming Deadlines', { exact: true })).toBeVisible();
      await expect(page.getByText('Pending Reviews', { exact: true })).toBeVisible();
      await expect(page.getByText('Consultation Reminders', { exact: true })).toBeVisible();

      // Seed data: assignment title visible in active assignments
      await expect(page.getByText('E2E Test Assignment').first()).toBeVisible();

      // No console errors
      expect(consoleErrors).toEqual([]);
    });
  });

  // ─── Instructor Dashboard ────────────────────────────────────────

  test.describe('Instructor Dashboard', () => {
    test.beforeAll(async ({ browser }) => {
      await ensureAuthFile(browser, 'instructor');
    });
    test.use({ storageState: getAuthFilePath('instructor') });

    test('loads with 4 widgets and seed data', async ({ page }) => {
      const consoleErrors = captureConsoleErrors(page);

      await page.goto('/instructor/dashboard');
      await page.waitForLoadState('networkidle');

      // Page title
      await expect(page.locator('h1')).toHaveText('Dashboard');

      // Metric cards (Pending Reviews, Active Assignments, Total Students)
      await expect(page.getByText('Total Students', { exact: true })).toBeVisible();

      // Pending Review Queue widget (appears in metric card + card title)
      await expect(page.getByText('Pending Reviews', { exact: true }).first()).toBeVisible();

      // Assignment Overview widget with seed data
      await expect(page.getByText('Assignment Overview', { exact: true })).toBeVisible();
      await expect(page.getByText('E2E Test Assignment').first()).toBeVisible();

      // Quick Actions widget
      await expect(page.getByText('Quick Actions', { exact: true })).toBeVisible();

      // No console errors
      expect(consoleErrors).toEqual([]);
    });
  });

  // ─── Admin Dashboard ─────────────────────────────────────────────

  test.describe('Admin Dashboard', () => {
    test.beforeAll(async ({ browser }) => {
      await ensureAuthFile(browser, 'admin');
    });
    test.use({ storageState: getAuthFilePath('admin') });

    test('loads with 4 widgets and seed data', async ({ page }) => {
      const consoleErrors = captureConsoleErrors(page);

      await page.goto('/admin/dashboard');
      await page.waitForLoadState('networkidle');

      // Scope to main content to avoid matching sidebar navigation links
      const main = page.getByRole('main');

      // Page title
      await expect(main.locator('h1')).toHaveText('Dashboard');

      // System metrics (6 metric cards)
      await expect(main.getByText('Total Users', { exact: true })).toBeVisible();
      await expect(main.getByText('Instructors', { exact: true })).toBeVisible();
      await expect(main.getByText('Students', { exact: true })).toBeVisible();
      await expect(main.getByText('Active Assignments', { exact: true })).toBeVisible();

      // Email Queue widget
      await expect(main.getByText('Email Queue', { exact: true })).toBeVisible();

      // Recent Activity widget (exact to avoid matching empty-state text)
      await expect(main.getByText('Recent Activity', { exact: true })).toBeVisible();

      // Quick Actions widget with navigation links
      await expect(main.getByText('Quick Actions', { exact: true })).toBeVisible();
      await expect(main.getByRole('link', { name: /Manage Users/ })).toBeVisible();
      await expect(main.getByRole('link', { name: /Manage Templates/ })).toBeVisible();

      // No console errors
      expect(consoleErrors).toEqual([]);
    });
  });
});
