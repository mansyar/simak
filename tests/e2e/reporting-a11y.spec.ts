import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ensureAuthFile, getAuthFilePath } from './helpers/auth';
import { resetDatabase } from './helpers/db-reset';

test.beforeAll(async () => {
  await resetDatabase();
});

function filterCriticalAndSerious(violations: Array<{ impact?: string | null }>) {
  return violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

function filterModerate(violations: Array<{ impact?: string | null }>) {
  return violations.filter((v) => v.impact === 'moderate');
}

async function scanReportingSurface(
  page: import('@playwright/test').Page,
  path: string,
  expectedCard: string,
  interact?: (page: import('@playwright/test').Page) => Promise<void>,
) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();
  await expect(page.getByText(expectedCard)).toBeVisible();

  if (interact) {
    await interact(page);
    await page.waitForLoadState('networkidle');
  }

  const results = await new AxeBuilder({ page }).analyze();
  expect(filterCriticalAndSerious(results.violations)).toEqual([]);
  expect(filterModerate(results.violations)).toEqual([]);
}

test.describe('Axe Accessibility Scans — Reporting Surfaces', () => {
  for (const [role, path, card] of [
    ['admin', '/admin/reports', 'Institutional Academic Summary'],
    ['instructor', '/instructor/reports', 'Analytics Summary'],
    ['student', '/student/reports', 'Official Transcript'],
  ] as const) {
    test.describe(`role: ${role}`, () => {
      test.beforeAll(async ({ browser }) => {
        await ensureAuthFile(browser, role);
      });
      test.use({ storageState: getAuthFilePath(role) });

      test(`${role} reports has no critical/serious/moderate a11y violations`, async ({ page }) => {
        await scanReportingSurface(
          page,
          path,
          card,
          role === 'admin'
            ? async (scannedPage) => {
                // Exercise the populated transcript picker (combobox/listbox)
                // so its interactive state is covered by the axe scan.
                await scannedPage.getByLabel('Search students').click();
                await expect(scannedPage.getByRole('option').first()).toBeVisible();
                await scannedPage.keyboard.press('ArrowDown');
                await scannedPage.keyboard.press('Enter');
              }
            : undefined,
        );
      });
    });
  }
});
