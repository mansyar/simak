import { test, expect } from '@playwright/test';
import { resetDatabase } from './helpers/db-reset';
import { loginAsRole } from './helpers/auth';

test.describe('Mobile Responsive Tests', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    await resetDatabase();
  });

  test('student dashboard renders correctly on mobile viewport', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAsRole(page, 'student');

    await page.goto('/student/dashboard');
    await page.waitForLoadState('networkidle');

    // Verify page heading is visible
    await expect(page.locator('h1')).toHaveText('Dashboard');

    // Verify key widgets are visible (using exact match to avoid sidebar conflicts)
    await expect(page.getByText('Next Actions', { exact: true })).toBeVisible();
    await expect(page.getByText('Active Assignments', { exact: true })).toBeVisible();

    // Verify no horizontal overflow (responsive layout)
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);

    await ctx.close();
  });

  test('student assignment detail renders correctly on mobile viewport', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAsRole(page, 'student');

    // Navigate to assignments list
    await page.goto('/student/assignments');
    await page.waitForLoadState('networkidle');

    // Click into the seeded assignment
    await expect(page.locator('text=E2E Test Assignment')).toBeVisible({ timeout: 15_000 });
    await page.click('a:has-text("View All")');
    await expect(page).toHaveURL(/\/student\/assignments\/\d+/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle');

    // Verify assignment title is visible
    await expect(page.locator('text=E2E Test Assignment').first()).toBeVisible();

    // Verify checkpoint list is visible
    await expect(page.getByText('Proposal').first()).toBeVisible();

    // Verify no horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);

    await ctx.close();
  });
});
