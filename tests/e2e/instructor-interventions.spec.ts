import { expect, test, type Browser } from '@playwright/test';
import postgres from 'postgres';
import { getAuthFilePath, ROLE_CREDENTIALS, type E2ERole } from './helpers/auth';
import { resetDatabase } from './helpers/db-reset';

async function ensureApiAuthFile(browser: Browser, role: E2ERole) {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto('/auth/login');
    const response = await page.evaluate(async (credentials) => {
      const result = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(credentials),
      });
      return { ok: result.ok, status: result.status };
    }, ROLE_CREDENTIALS[role]);

    if (!response.ok) throw new Error(`Login failed for ${role}: API returned ${response.status}`);
    await context.storageState({ path: getAuthFilePath(role) });
  } finally {
    await context.close();
  }
}

async function seedPendingReviewRisk() {
  const sql = postgres(process.env.DATABASE_URL!);

  try {
    const [checkpoint] = await sql<
      {
        checkpointId: number;
        studentId: string;
      }[]
    >`
      SELECT c.id AS "checkpointId", c.student_id AS "studentId"
      FROM checkpoints c
      INNER JOIN assignments a ON a.id = c.assignment_id
      INNER JOIN users u ON u.id = c.student_id
      WHERE a.title = 'E2E Test Assignment'
        AND u.email = 'student@e2e.test'
        AND c.order = 1
    `;

    await sql`
      UPDATE checkpoints
      SET state = 'under_review'
      WHERE id = ${checkpoint.checkpointId}
    `;
    await sql`
      INSERT INTO submissions (
        checkpoint_id,
        uploaded_by,
        file_key,
        file_name,
        file_size,
        version,
        uploaded_at
      )
      VALUES (
        ${checkpoint.checkpointId},
        ${checkpoint.studentId},
        ${`e2e-pending-review-${Date.now()}.pdf`},
        'pending-review.pdf',
        1024,
        1,
        NOW() - INTERVAL '5 days'
      )
    `;
  } finally {
    await sql.end();
  }
}

test.describe('Instructor Intervention Workflow', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000);
    await resetDatabase();
    await ensureApiAuthFile(browser, 'instructor');
    await ensureApiAuthFile(browser, 'student');
    await ensureApiAuthFile(browser, 'admin');
  });

  test.use({ storageState: getAuthFilePath('instructor') });

  test('creates, manages, and surfaces an intervention for a live at-risk student', async ({
    page,
  }) => {
    await seedPendingReviewRisk();
    await page.goto('/instructor/assignments');
    await expect(page.getByText('E2E Test Assignment').first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('link', { name: 'View All' }).first().click();
    await expect(page).toHaveURL(/\/instructor\/assignments\/\d+/);
    await page.waitForLoadState('networkidle');

    const interventionTab = page.getByRole('button', { name: 'At-Risk Interventions' });
    await expect(interventionTab).toHaveAttribute('data-state', 'inactive');
    await interventionTab.click();
    await page.waitForLoadState('networkidle');
    await expect(interventionTab).toHaveAttribute('data-state', 'active');
    const studentOneCard = page
      .locator('article')
      .filter({ has: page.getByRole('heading', { name: 'Student', exact: true }) });
    await expect(
      studentOneCard.getByText('A submission is waiting for review beyond the SLA'),
    ).toBeVisible();
    await expect(studentOneCard.getByRole('link', { name: 'Create intervention' })).toHaveCount(0);
    const createLink = page.getByRole('link', { name: 'Create intervention' });
    await expect(createLink).toBeVisible({ timeout: 15_000 });
    await createLink.click();

    await expect(page).toHaveURL(/\/instructor\/interventions\?assignmentId=\d+&studentId=/);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Create intervention', { exact: true }).first()).toBeVisible();
    await page.getByRole('combobox', { name: 'Action type' }).click();
    await page.getByRole('option', { name: 'Discussion', exact: true }).click();
    await page.fill('#intervention-private-note', 'Discuss the overdue proposal and next step.');
    const overdueDate = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    await page.fill('#intervention-follow-up-date', overdueDate);
    await page.getByRole('button', { name: 'Create intervention' }).click();

    await expect(page.getByText('Intervention saved')).toBeVisible({ timeout: 15_000 });
    await expect(
      page
        .getByRole('list', { name: 'Instructor interventions' })
        .getByText('Open', { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('list', { name: 'Instructor interventions' })
        .getByText('Overdue follow-up', { exact: true }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Manage' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Manage intervention', { exact: true }).first()).toBeVisible();
    const statusSelect = page.locator('#intervention-status');
    await statusSelect.click();
    await page.getByRole('option', { name: 'Monitoring', exact: true }).click();
    await expect(statusSelect).toContainText('Monitoring');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('#intervention-status')).toHaveCount(0, { timeout: 15_000 });
    await expect(
      page
        .getByRole('list', { name: 'Instructor interventions' })
        .getByText('Monitoring', { exact: true }),
    ).toBeVisible();

    await page.goto('/instructor/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('At-Risk Interventions', { exact: true })).toBeVisible();
    await expect(page.getByText('Monitoring', { exact: true })).toBeVisible();
  });

  test('keeps instructor intervention records private from students and admins', async ({
    browser,
  }) => {
    for (const role of ['student', 'admin'] as const) {
      const context = await browser.newContext({ storageState: getAuthFilePath(role) });
      const page = await context.newPage();

      try {
        await page.goto('/instructor/interventions');
        if (role === 'student') {
          await expect(page).toHaveURL(/\/student\/dashboard/);
        } else {
          await expect(page).toHaveURL(/\/instructor\/interventions/);
          await expect(
            page.getByText('Unable to load interventions', { exact: true }),
          ).toBeVisible();
          await expect(page.getByText('Unauthorized', { exact: true })).toBeVisible();
          await expect(page.getByRole('list', { name: 'Instructor interventions' })).toHaveCount(0);
        }
      } finally {
        await context.close();
      }
    }
  });
});
