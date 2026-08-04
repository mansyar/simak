import {
  expect,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';
import { loginAsRole, type E2ERole } from './auth';

export const AUDIT_VIEWPORTS = {
  mobile: { width: 320, height: 640 },
  tablet: { width: 768, height: 900 },
  desktop: { width: 1280, height: 900 },
} as const;

export type AuditViewport = keyof typeof AUDIT_VIEWPORTS;

/**
 * Create an authenticated page with a named audit viewport.
 * The returned context is owned by the caller and must be closed after use.
 */
export async function createAuditPage(
  browser: Browser,
  role: E2ERole,
  viewport: AuditViewport = 'desktop',
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ viewport: AUDIT_VIEWPORTS[viewport] });
  const page = await context.newPage();

  await loginAsRole(page, role);

  return { context, page };
}

export async function assertKeyboardFocusable(locator: Locator): Promise<void> {
  await locator.focus();
  await expect(locator).toBeFocused();
}

export async function assertAccessibleName(locator: Locator, name: string | RegExp): Promise<void> {
  await expect(locator).toHaveAccessibleName(name);
}

export async function assertFullyWithinViewport(page: Page, locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();

  if (!box) {
    throw new Error('Expected the audited element to have a visible bounding box.');
  }

  if (!viewport) {
    throw new Error('Expected the audited page to have a configured viewport.');
  }

  expect(box.x, 'element starts outside the left edge of the viewport').toBeGreaterThanOrEqual(0);
  expect(box.y, 'element starts outside the top edge of the viewport').toBeGreaterThanOrEqual(0);
  expect(
    box.x + box.width,
    'element is clipped by the right edge of the viewport',
  ).toBeLessThanOrEqual(viewport.width);
  expect(
    box.y + box.height,
    'element is clipped by the bottom edge of the viewport',
  ).toBeLessThanOrEqual(viewport.height);
}

export async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );

  expect(hasOverflow, 'the document has horizontal overflow').toBe(false);
}

export async function assertLiveRegion(locator: Locator): Promise<void> {
  await expect(locator).toHaveCount(1);

  const isLive = await locator.evaluate((element) => {
    const role = element.getAttribute('role');
    const ariaLive = element.getAttribute('aria-live');

    return Boolean(
      ariaLive ||
      role === 'alert' ||
      role === 'log' ||
      role === 'marquee' ||
      role === 'status' ||
      role === 'timer',
    );
  });

  expect(isLive, 'expected the element to expose live-region semantics').toBe(true);
}
