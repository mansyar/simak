import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import postgres from 'postgres';
import { getDatabaseUrl, resetDatabase } from './helpers/db-reset';
import { loginAsRole } from './helpers/auth';

function moderateOrHigherViolations(violations: Array<{ impact?: string | null }>) {
  return violations.filter((violation) =>
    ['critical', 'serious', 'moderate'].includes(violation.impact ?? ''),
  );
}

async function getE2ESectionId(): Promise<number> {
  const sql = postgres(getDatabaseUrl());
  try {
    const [section] = await sql<{ id: number }[]>`
      SELECT course_sections.id
      FROM course_sections
      INNER JOIN courses ON courses.id = course_sections.course_id
      WHERE courses.code = 'E2E-THESIS' AND course_sections.code = 'A'
      LIMIT 1
    `;
    if (!section) throw new Error('E2E academic section was not seeded.');
    return section.id;
  } finally {
    await sql.end();
  }
}

test.describe('Academic records cross-role workflow', () => {
  test.beforeAll(async () => {
    await resetDatabase();
  });

  test('student sees released records, GPA summaries, filtering, and accessible states', async ({
    page,
  }) => {
    await loginAsRole(page, 'student');
    await page.goto('/student/academic-records');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Academic records' })).toBeVisible();
    await expect(page.getByText('E2E-THESIS', { exact: true })).toBeVisible();
    await expect(page.getByText('E2E Thesis Course', { exact: true })).toBeVisible();
    await expect(page.getByText('Term GPA', { exact: true })).toBeVisible();
    await expect(page.getByText('Cumulative GPA', { exact: true })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Academic term' })).toBeVisible();
    await expect(page.getByText('Source assignment', { exact: true })).toHaveCount(0);

    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(moderateOrHigherViolations(accessibility.violations)).toEqual([]);
  });

  test('admin sees record provenance while instructor access stays section-scoped', async ({
    browser,
  }) => {
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await loginAsRole(adminPage, 'admin');
    await adminPage.goto('/admin/academic-records');
    await adminPage.waitForLoadState('networkidle');

    await expect(adminPage.getByText('Source assignment', { exact: true })).toHaveCount(2);
    await expect(adminPage.getByText('Source release', { exact: true })).toHaveCount(2);
    await expect(adminPage.getByText('Policy version', { exact: true })).toHaveCount(2);
    await expect(adminPage.getByText('Record version', { exact: true })).toHaveCount(2);
    await adminContext.close();

    const sectionId = await getE2ESectionId();
    const instructorContext = await browser.newContext();
    const instructorPage = await instructorContext.newPage();
    await loginAsRole(instructorPage, 'instructor');
    await instructorPage.goto(`/instructor/academic-records?sectionId=${sectionId}`);
    await instructorPage.waitForLoadState('networkidle');
    await expect(instructorPage.getByText('E2E-THESIS', { exact: true })).toHaveCount(2);
    await expect(instructorPage.getByText('Source assignment', { exact: true })).toHaveCount(0);
    await instructorContext.close();

    const unauthorizedContext = await browser.newContext();
    const unauthorizedPage = await unauthorizedContext.newPage();
    await loginAsRole(unauthorizedPage, 'instructor2');
    await unauthorizedPage.goto(`/instructor/academic-records?sectionId=${sectionId}`);
    await unauthorizedPage.waitForLoadState('networkidle');
    await expect(unauthorizedPage.getByRole('alert')).toContainText(/permission|forbidden/i);
    await unauthorizedContext.close();
  });
});
