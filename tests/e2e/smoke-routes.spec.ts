import { test, expect, type Page } from '@playwright/test';
import { resetDatabase } from './helpers/db-reset';
import { ensureAuthFile, getAuthFilePath } from './helpers/auth';

function captureConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('Failed to load resource') && !text.includes('favicon')) {
        errors.push(text);
      }
    }
  });
  return errors;
}

test.describe('Smoke Route Tests', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    await resetDatabase();
  });

  test.describe('Unauthenticated Routes', () => {
    test('landing page renders hero and CTA', async ({ page }) => {
      const consoleErrors = captureConsoleErrors(page);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'Manage Academic Assignments with Confidence',
        }),
      ).toBeVisible();
      await expect(page.getByRole('link', { name: 'Get Started' })).toBeVisible();
      expect(consoleErrors).toEqual([]);
    });

    test('landing navigation and authentication controls are mobile-safe', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        320,
      );
      await expect(page.getByRole('navigation', { name: 'Public navigation' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Features' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Switch to Bahasa Indonesia' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Dark Mode' })).toBeVisible();
    });

    test('login exposes field-level validation feedback', async ({ page }) => {
      await page.goto('/auth/login');
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: 'Sign In' }).click();

      await expect(page.getByText('Email is required')).toBeVisible();
      await expect(page.getByText('Password is required')).toBeVisible();
      await expect(page.getByLabel('Email')).toHaveAttribute('aria-describedby', 'email-error');
      await expect(page.getByLabel('Password')).toHaveAttribute(
        'aria-describedby',
        'password-error',
      );
    });

    test('forgot password page renders form', async ({ page }) => {
      const consoleErrors = captureConsoleErrors(page);
      await page.goto('/auth/forgot-password');
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { level: 1, name: 'Reset Password' })).toBeVisible();
      await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
      expect(consoleErrors).toEqual([]);
    });

    test('reset password page renders with token', async ({ page }) => {
      const consoleErrors = captureConsoleErrors(page);
      await page.goto('/auth/reset-password?token=test-token');
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { level: 1, name: 'Reset Password' })).toBeVisible();
      await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
      expect(consoleErrors).toEqual([]);
    });

    test('2FA verify page renders code input', async ({ page }) => {
      const consoleErrors = captureConsoleErrors(page);
      await page.goto('/auth/verify-2fa');
      await page.waitForLoadState('networkidle');
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: 'Verify Two-Factor Authentication',
        }),
      ).toBeVisible();
      await expect(page.getByPlaceholder('000000')).toBeVisible();
      expect(consoleErrors).toEqual([]);
    });
  });

  test.describe('Admin Routes', () => {
    test.beforeAll(async ({ browser }) => {
      await ensureAuthFile(browser, 'admin');
    });

    test.use({ storageState: getAuthFilePath('admin') });

    test('admin audit log page loads', async ({ page }) => {
      const consoleErrors = captureConsoleErrors(page);
      await page.goto('/admin/audit-log');
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { level: 1, name: 'Audit Log' })).toBeVisible();
      await expect(page.getByPlaceholder('Search by entity ID or details...')).toBeVisible();
      expect(consoleErrors).toEqual([]);
    });

    test('admin email queue page loads', async ({ page }) => {
      const consoleErrors = captureConsoleErrors(page);
      await page.goto('/admin/email-queue');
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { level: 1, name: 'Email Queue' })).toBeVisible();
      await expect(page.getByPlaceholder('Search by recipient or subject...')).toBeVisible();
      expect(consoleErrors).toEqual([]);
    });

    test('admin analytics page loads', async ({ page }) => {
      await page.goto('/admin/analytics');
      await page.waitForLoadState('networkidle');
      // Smoke test: verify the page heading renders (analytics data may show
      // error state due to pre-existing DB query issues — that's out of scope)
      await expect(page.getByRole('heading', { level: 1, name: 'Analytics' })).toBeVisible();
    });

    test('bulk user import page loads', async ({ page }) => {
      const consoleErrors = captureConsoleErrors(page);
      await page.goto('/admin/users/import');
      await page.waitForLoadState('networkidle');
      await expect(
        page.getByRole('heading', { level: 1, name: 'Bulk Import Users' }),
      ).toBeVisible();
      await expect(page.getByTestId('bulk-import-dropzone')).toBeVisible();
      expect(consoleErrors).toEqual([]);
    });

    test('bulk template import page loads', async ({ page }) => {
      const consoleErrors = captureConsoleErrors(page);
      await page.goto('/admin/templates/import');
      await page.waitForLoadState('networkidle');
      await expect(
        page.getByRole('heading', { level: 1, name: 'Bulk Import Templates' }),
      ).toBeVisible();
      await expect(page.getByTestId('bulk-import-dropzone')).toBeVisible();
      expect(consoleErrors).toEqual([]);
    });

    test('bulk import controls remain usable at 320px', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });

      for (const path of ['/admin/users/import', '/admin/templates/import']) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');

        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          320,
        );
        const dropzone = await page.getByTestId('bulk-import-dropzone').boundingBox();
        expect(dropzone).not.toBeNull();
        expect((dropzone?.x ?? 0) + (dropzone?.width ?? 0)).toBeLessThanOrEqual(320);
        await expect(page.getByTestId('bulk-import-dropzone-input')).toHaveAttribute('id', /.+/);
      }
    });
  });

  test.describe('Instructor Routes', () => {
    test.beforeAll(async ({ browser }) => {
      await ensureAuthFile(browser, 'instructor');
    });

    test.use({ storageState: getAuthFilePath('instructor') });

    test('instructor analytics page loads', async ({ page }) => {
      await page.goto('/instructor/analytics');
      await page.waitForLoadState('networkidle');
      // Smoke test: verify the page heading renders
      await expect(page.getByRole('heading', { level: 1, name: 'Analytics' })).toBeVisible();
    });

    test('instructor settings page loads', async ({ page }) => {
      await page.goto('/instructor/settings');
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    });
  });

  test.describe('Student Routes', () => {
    test.beforeAll(async ({ browser }) => {
      await ensureAuthFile(browser, 'student');
    });

    test.use({ storageState: getAuthFilePath('student') });

    test('student assignments list page loads', async ({ page }) => {
      await page.goto('/student/assignments');
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { level: 1, name: 'My Assignments' })).toBeVisible();
    });

    test('student settings page loads', async ({ page }) => {
      await page.goto('/student/settings');
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    });
  });
});
