import { test, expect } from '@playwright/test';
import postgres from 'postgres';
import { resetDatabase, getDatabaseUrl } from './helpers/db-reset';
import { loginAsRole } from './helpers/auth';

async function seedWaitingRecords(): Promise<void> {
  const sql = postgres(getDatabaseUrl());

  try {
    const [student] = await sql`
      SELECT id FROM users WHERE email = 'student@e2e.test' LIMIT 1
    `;
    const [instructor] = await sql`
      SELECT id FROM users WHERE email = 'instructor@e2e.test' LIMIT 1
    `;
    const checkpoints = await sql`
      SELECT c.id, c.name
      FROM checkpoints c
      JOIN users u ON c.student_id = u.id
      WHERE u.email = 'student@e2e.test' AND c.name IN ('Chapter 1', 'Chapter 2')
      ORDER BY c.name
    `;

    for (const checkpoint of checkpoints) {
      await sql`
        INSERT INTO submissions (checkpoint_id, uploaded_by, file_key, file_name, file_size, version, uploaded_at)
        VALUES (
          ${checkpoint.id},
          ${student.id},
          ${`e2e-next-actions/${checkpoint.name}.pdf`},
          ${`${checkpoint.name}.pdf`},
          1024,
          1,
          NOW() - INTERVAL '45 days'
        )
      `;
    }

    const [chapterOne] = checkpoints.filter((checkpoint) => checkpoint.name === 'Chapter 1');
    const [chapterTwo] = checkpoints.filter((checkpoint) => checkpoint.name === 'Chapter 2');

    if (chapterOne) {
      await sql`UPDATE checkpoints SET state = 'submitted' WHERE id = ${chapterOne.id}`;
    }

    if (chapterTwo) {
      const [submission] = await sql`
        SELECT id FROM submissions WHERE checkpoint_id = ${chapterTwo.id} LIMIT 1
      `;
      await sql`UPDATE checkpoints SET state = 'under_review' WHERE id = ${chapterTwo.id}`;
      await sql`
        INSERT INTO reviews (submission_id, instructor_id, decision, comment, created_at)
        VALUES (${submission.id}, ${instructor.id}, 'revise', 'E2E waiting review', NOW() - INTERVAL '45 days')
      `;
    }
  } finally {
    await sql.end();
  }
}

test.describe('Student Next Actions', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    await resetDatabase();
    await seedWaitingRecords();
  });

  test('shows prioritized action, stale waiting work, precise links, and caps', async ({
    page,
  }) => {
    await loginAsRole(page, 'student');
    await page.goto('/student/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Next Actions' })).toBeVisible();
    await expect(page.getByText('Complete required consultation', { exact: true })).toBeVisible();
    await expect(page.getByText('Consultation required', { exact: true })).toBeVisible();

    const primaryActions = page.getByLabel('Next Actions', { exact: true });
    await expect(primaryActions.getByRole('link')).toHaveCount(1);
    await expect(
      page.getByRole('link', {
        name: 'Complete required consultation for Proposal in E2E Test Assignment',
        exact: true,
      }),
    ).toHaveAttribute('href', /\/student\/assignments\/\d+$/);
    await expect(
      page.getByRole('link', { name: 'Open Proposal in E2E Test Assignment', exact: true }),
    ).toHaveCount(0);

    await expect(page.getByText('Submitted', { exact: true })).toBeVisible();
    await expect(page.getByText('Under Review', { exact: true })).toBeVisible();
    await expect(page.getByText('1 checkpoint(s)', { exact: true })).toHaveCount(2);
    await expect(
      page.getByRole('link', {
        name: 'Open Chapter 1 in E2E Test Assignment',
        exact: true,
      }),
    ).toHaveAttribute('href', /\/student\/assignments\/\d+\/checkpoints\/\d+$/);
    await expect(
      page.getByRole('link', {
        name: 'Open Chapter 2 in E2E Test Assignment',
        exact: true,
      }),
    ).toHaveAttribute('href', /\/student\/assignments\/\d+\/checkpoints\/\d+$/);

    // These records are older than the existing 30-day pending-review widget window,
    // but remain visible in the all-age waiting summary.
    await expect(page.getByText('No pending reviews', { exact: true })).toBeVisible();
    expect(await primaryActions.getByRole('link').count()).toBeLessThanOrEqual(5);
  });
});
