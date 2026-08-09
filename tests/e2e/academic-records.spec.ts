import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import postgres from 'postgres';
import { getDatabaseUrl, resetDatabase } from './helpers/db-reset';
import { ensureAuthFile, getAuthFilePath, loginAsRole } from './helpers/auth';

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

async function prepareDraftTranscriptSource() {
  const sql = postgres(getDatabaseUrl());
  try {
    const [assignment] = await sql<{ id: number }[]>`
      SELECT id FROM assignments WHERE title = 'E2E Test Assignment' LIMIT 1
    `;
    if (!assignment) throw new Error('E2E transcript assignment was not seeded.');

    await sql`
      UPDATE assignment_grade_config
      SET release_status = 'draft', active_release_version = NULL, published_at = NULL
      WHERE assignment_id = ${assignment.id}
    `;
  } finally {
    await sql.end();
  }
}

async function seedEmptyAcademicTerm(): Promise<string> {
  const sql = postgres(getDatabaseUrl());
  const name = 'E2E Empty Term';
  try {
    await sql`
      INSERT INTO academic_terms (code, name, start_date, end_date, status)
      VALUES ('E2E-EMPTY', ${name}, '2026-07-01', '2026-12-31', 'draft')
    `;
    return name;
  } finally {
    await sql.end();
  }
}

async function openInstructorGradebook(page: Page) {
  await page.goto('/instructor/assignments');
  await page.getByRole('link', { name: /view all/i }).click();
  const gradebookHref = await page.getByRole('link', { name: /gradebook/i }).getAttribute('href');
  if (!gradebookHref) throw new Error('Gradebook link did not include an href.');
  await page.goto(gradebookHref);
  await page.waitForLoadState('networkidle');
}

test.describe('Academic records cross-role workflow', () => {
  test.setTimeout(120_000);

  test.beforeEach(async () => {
    await resetDatabase();
  });

  test('publishing a transcript source creates the student academic record', async ({
    browser,
  }) => {
    await prepareDraftTranscriptSource();
    await ensureAuthFile(browser, 'student');
    await ensureAuthFile(browser, 'instructor');

    const studentContext = await browser.newContext({ storageState: getAuthFilePath('student') });
    const studentPage = await studentContext.newPage();
    await studentPage.goto('/student/academic-records');
    await expect(studentPage.getByText('E2E-THESIS', { exact: true })).toHaveCount(1);

    const instructorContext = await browser.newContext({
      storageState: getAuthFilePath('instructor'),
    });
    const instructorPage = await instructorContext.newPage();
    await openInstructorGradebook(instructorPage);
    await instructorPage.getByRole('button', { name: /publish/i }).click();
    await expect(instructorPage.getByText(/eligible/i)).toBeVisible();
    await instructorPage.getByRole('checkbox').check();
    await instructorPage
      .getByRole('button', { name: /publish/i })
      .last()
      .click();
    await expect(
      instructorPage.getByLabel(/release status/i).getByText(/published/i),
    ).toBeVisible();

    await studentPage.reload({ waitUntil: 'networkidle' });
    await expect(studentPage.getByText('E2E-THESIS', { exact: true })).toHaveCount(2);
    await expect(studentPage.getByText('93.75', { exact: true })).toHaveCount(2);
    await expect(studentPage.getByText('Term GPA', { exact: true })).toBeVisible();

    await instructorContext.close();
    await studentContext.close();
  });

  test('student filters with the keyboard and keeps localized responsive dark-mode UX', async ({
    page,
  }) => {
    const emptyTermName = await seedEmptyAcademicTerm();
    await loginAsRole(page, 'student');
    await page.goto('/student/dashboard');

    const recordsLink = page.getByRole('link', { name: 'Academic records' });
    await expect(recordsLink).toBeVisible();
    await recordsLink.click();
    await expect(recordsLink).toHaveAttribute('aria-current', 'page');

    const termFilter = page.getByRole('combobox', { name: 'Academic term' });
    await termFilter.focus();
    await expect(termFilter).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('option', { name: emptyTermName })).toBeVisible();
    await page.getByRole('option', { name: emptyTermName }).click();

    await expect(page).toHaveURL(/termId=/);
    await expect(page.getByText('No records in this academic term')).toBeVisible();
    const resultsStatus = page.locator('[role="status"][aria-live="polite"]').last();
    await expect(resultsStatus).toContainText('Academic records updated: 0 records, page 1.');
    await expect(resultsStatus).toBeFocused();

    await page.getByRole('button', { name: 'Toggle theme' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.getByRole('button', { name: 'ID', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Rekam akademik' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Periode akademik' })).toBeVisible();

    await page.setViewportSize({ width: 320, height: 640 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBeTruthy();

    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(moderateOrHigherViolations(accessibility.violations)).toEqual([]);
  });

  test('admin provenance and instructor section boundaries remain role-specific', async ({
    browser,
  }) => {
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await loginAsRole(adminPage, 'admin');
    await adminPage.goto('/admin/dashboard');
    await adminPage.getByRole('link', { name: 'Academic records' }).click();
    await expect(adminPage.getByText('Source assignment', { exact: true })).toHaveCount(2);
    await expect(adminPage.getByText('Source release', { exact: true })).toHaveCount(2);
    await adminContext.close();

    const sectionId = await getE2ESectionId();
    const instructorContext = await browser.newContext();
    const instructorPage = await instructorContext.newPage();
    await loginAsRole(instructorPage, 'instructor');
    await instructorPage.goto(`/instructor/academic-records?sectionId=${sectionId}`);
    await expect(instructorPage.getByText('E2E-THESIS', { exact: true })).toHaveCount(2);
    await expect(instructorPage.getByText('Source assignment', { exact: true })).toHaveCount(0);
    await instructorContext.close();

    const unauthorizedContext = await browser.newContext();
    const unauthorizedPage = await unauthorizedContext.newPage();
    await loginAsRole(unauthorizedPage, 'instructor2');
    await unauthorizedPage.goto(`/instructor/academic-records?sectionId=${sectionId}`);
    await expect(unauthorizedPage.getByRole('alert')).toContainText(/permission|forbidden/i);
    await unauthorizedContext.close();
  });
});
