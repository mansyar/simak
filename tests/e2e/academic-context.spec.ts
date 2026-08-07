import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import postgres from 'postgres';
import { getDatabaseUrl, resetDatabase } from './helpers/db-reset';
import { loginAsRole } from './helpers/auth';

test.beforeAll(async () => {
  await resetDatabase();
});

async function getAssignmentSnapshot(id: number) {
  const sql = postgres(getDatabaseUrl());

  try {
    const [assignment] = await sql<
      {
        id: number;
        sectionId: number;
        status: string;
      }[]
    >`
      SELECT id, section_id AS "sectionId", status
      FROM assignments
      WHERE id = ${id} AND deleted_at IS NULL
      LIMIT 1
    `;
    if (!assignment) return null;

    const [students] = await sql<{ count: string }[]>`
      SELECT count(*)::text AS count FROM assignment_students WHERE assignment_id = ${assignment.id}
    `;
    const [checkpoints] = await sql<{ count: string }[]>`
      SELECT count(*)::text AS count FROM checkpoints WHERE assignment_id = ${assignment.id}
    `;

    return {
      ...assignment,
      studentCount: Number(students?.count ?? 0),
      checkpointCount: Number(checkpoints?.count ?? 0),
    };
  } finally {
    await sql.end();
  }
}

async function getLatestAssignmentIdAfter(id: number) {
  const sql = postgres(getDatabaseUrl());

  try {
    const [assignment] = await sql<{ id: number }[]>`
      SELECT id FROM assignments WHERE id > ${id} AND deleted_at IS NULL ORDER BY id DESC LIMIT 1
    `;
    return assignment?.id ?? null;
  } finally {
    await sql.end();
  }
}

async function waitForNewAssignment(afterId: number) {
  let latestId: number | null = null;

  await expect
    .poll(
      async () => {
        latestId = await getLatestAssignmentIdAfter(afterId);
        return latestId;
      },
      { timeout: 30_000 },
    )
    .not.toBeNull();

  if (latestId === null) {
    throw new Error(`No assignment was created after ${afterId}.`);
  }

  return latestId;
}

test.describe('Academic context cross-role surfaces', () => {
  test('admin can view seeded terms, courses, sections, and enrollments', async ({ page }) => {
    await loginAsRole(page, 'admin');
    await page.goto('/admin/academic-context');

    await expect(page.getByRole('heading', { name: 'Academic Context' })).toBeVisible();
    await expect(page.getByText('E2E-2026-1', { exact: true })).toBeVisible();
    await expect(page.getByText('E2E-THESIS', { exact: true })).toBeVisible();
    await expect(page.getByText('E2E Thesis Section', { exact: true })).toBeVisible();
    await expect(page.getByText('Student', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Archive/ })).toHaveCount(3);
  });

  test('instructor sees authorized sections and lifecycle-aware assignment controls', async ({
    page,
  }) => {
    await loginAsRole(page, 'instructor');
    await page.goto('/instructor/assignments?status=active');

    const sectionFilter = page.getByRole('combobox').first();
    await expect(sectionFilter.locator('option', { hasText: 'E2E-THESIS' })).toHaveCount(1);
    await expect(page.getByText('E2E-THESIS', { exact: true })).toBeVisible();
    await expect(page.getByText('E2E Thesis Section', { exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'E2E Test Assignment' }).click();
    await expect(page.getByRole('button', { name: 'Archive' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clone' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rollover' })).toBeVisible();

    await page.getByRole('button', { name: 'Clone' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByLabel('Target course section')).toBeVisible();
  });

  test('instructor creates an assignment in an authorized academic section', async ({ page }) => {
    await loginAsRole(page, 'instructor');
    await page.goto('/instructor/assignments/new');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('E2E Thesis Template', { exact: true })).toBeVisible();
    await page.getByText('E2E Thesis Template', { exact: true }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    const sectionSelect = page.getByLabel('Section');
    const sectionOption = sectionSelect.locator('option').filter({ hasText: 'E2E-THESIS' }).first();
    await sectionSelect.selectOption((await sectionOption.getAttribute('value')) ?? '');
    await page.fill('#assignment-title', 'E2E Academic Context Assignment');
    await page.fill('#assignment-desc', 'Created in an authorized academic section.');

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 90);
    await page.fill('#assignment-deadline', deadline.toISOString().slice(0, 16));
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByText('student@e2e.test')).toBeVisible();
    await page.getByText('student@e2e.test').click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Confirm & Create' })).toBeVisible();
    await page.getByRole('button', { name: 'Create Assignment' }).click();

    await expect(page).toHaveURL(/\/instructor\/assignments\/\d+/, { timeout: 30_000 });
    await expect(page.getByText('E2E Academic Context Assignment', { exact: true })).toBeVisible();
    await expect(page.getByText('E2E-THESIS', { exact: true })).toBeVisible();

    page.on('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Activate' }).click();
    await expect(page.getByText('Active', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Archive' }).click();
    await expect(page.getByText('Archived', { exact: true })).toBeVisible();
  });

  test('instructor clone and rollover preserve source history and create independent drafts', async ({
    page,
  }) => {
    await loginAsRole(page, 'instructor');
    await page.goto('/instructor/assignments');
    await page.getByRole('link', { name: 'E2E Test Assignment' }).click();

    const sourceUrl = page.url();
    const sourceId = Number(sourceUrl.split('/').pop());
    const sourceBefore = await getAssignmentSnapshot(sourceId);
    expect(sourceBefore?.status).toBe('active');
    expect(sourceBefore?.studentCount).toBeGreaterThan(0);

    const createCopy = async (
      operation: 'Clone' | 'Rollover',
      title: string,
      navigateToSource = true,
    ) => {
      if (navigateToSource) await page.goto(sourceUrl);
      await page.waitForLoadState('networkidle');
      const actionName = operation === 'Clone' ? 'Clone assignment' : 'Rollover semester';
      await expect(page.getByRole('button', { name: actionName })).toBeVisible();
      await page.getByRole('button', { name: actionName }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 60);
      await dialog.getByLabel('New final deadline').fill(deadline.toISOString().slice(0, 10));
      await dialog.getByLabel('New assignment title').fill(title);
      await dialog.getByRole('button', { name: operation }).click();
      await expect(dialog).toBeHidden({ timeout: 30_000 });
    };

    const cloneTitle = `E2E UI Clone ${Date.now()}`;
    await createCopy('Clone', cloneTitle, false);
    const cloneId = await waitForNewAssignment(sourceId);
    const clone = await getAssignmentSnapshot(cloneId);
    expect(clone?.status).toBe('draft');
    expect(clone?.sectionId).toBe(sourceBefore?.sectionId);
    expect(clone?.studentCount).toBe(0);
    expect(clone?.checkpointCount).toBe(0);

    const rolloverTitle = `E2E UI Rollover ${Date.now()}`;
    await createCopy('Rollover', rolloverTitle);
    const rolloverId = await waitForNewAssignment(cloneId);
    const rollover = await getAssignmentSnapshot(rolloverId);
    const sourceAfter = await getAssignmentSnapshot(sourceId);
    expect(rollover?.status).toBe('draft');
    expect(rollover?.studentCount).toBe(0);
    expect(sourceAfter).toMatchObject(sourceBefore ?? {});
  });

  test('student sees context on assignment and dashboard cards', async ({ page }) => {
    await loginAsRole(page, 'student');
    await page.goto('/student/assignments');

    await expect(page.getByText('E2E-THESIS', { exact: true })).toBeVisible();
    await expect(page.getByText('E2E Thesis Section', { exact: true })).toBeVisible();
    await expect(page.getByText('E2E Academic Term', { exact: true })).toBeVisible();

    await page.goto('/student/dashboard');
    await expect(page.getByText('E2E-THESIS', { exact: true })).toBeVisible();
    await expect(page.getByText('E2E Thesis Section', { exact: true })).toBeVisible();
  });

  test('new academic-context surfaces remain usable on a 320px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await loginAsRole(page, 'student');
    await page.goto('/student/assignments');

    const widths = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(widths.documentWidth).toBeLessThanOrEqual(widths.viewportWidth);
  });

  test('admin academic-context page has no critical or serious axe violations', async ({
    page,
  }) => {
    await loginAsRole(page, 'admin');
    await page.goto('/admin/academic-context');
    await expect(page.getByRole('heading', { name: 'Academic Context' })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter(
        (violation) => violation.impact === 'critical' || violation.impact === 'serious',
      ),
    ).toEqual([]);
  });

  test('students cannot access instructor assignment management', async ({ page }) => {
    await loginAsRole(page, 'student');
    await page.goto('/instructor/assignments');
    await expect(page).toHaveURL(/\/student\/dashboard/);
  });
});
