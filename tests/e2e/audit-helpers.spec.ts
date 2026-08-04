import { expect, test } from '@playwright/test';
import {
  AUDIT_VIEWPORTS,
  assertAccessibleName,
  assertFullyWithinViewport,
  assertKeyboardFocusable,
  assertLiveRegion,
  assertNoHorizontalOverflow,
  createAuditPage,
} from './helpers/ui-audit';

test.describe('UI audit helpers', () => {
  test('defines the supported audit viewports', () => {
    expect(AUDIT_VIEWPORTS).toEqual({
      mobile: { width: 320, height: 640 },
      tablet: { width: 768, height: 900 },
      desktop: { width: 1280, height: 900 },
    });
  });

  test('creates an authenticated page at a named viewport', async ({ browser }) => {
    const { context, page } = await createAuditPage(browser, 'student', 'mobile');

    try {
      expect(page.viewportSize()).toEqual(AUDIT_VIEWPORTS.mobile);
      await expect(page).toHaveURL(/\/student\/dashboard/);
    } finally {
      await context.close();
    }
  });

  test('provides reusable keyboard, name, viewport, overflow, and live-region assertions', async ({
    page,
  }) => {
    await page.goto('/auth/login');

    const email = page.locator('#email');
    const signIn = page.getByRole('button', { name: 'Sign In' });
    await page.evaluate(() => {
      const liveRegion = document.createElement('div');
      liveRegion.dataset.auditLiveRegion = 'true';
      liveRegion.setAttribute('role', 'status');
      document.body.append(liveRegion);
    });
    const notificationRegion = page.locator('[data-audit-live-region]');

    await assertKeyboardFocusable(email);
    await assertAccessibleName(email, 'Email');
    await assertFullyWithinViewport(page, signIn);
    await assertNoHorizontalOverflow(page);
    await assertLiveRegion(notificationRegion);
  });
});
