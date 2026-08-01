import { test, expect, type Page } from '@playwright/test';
import postgres from 'postgres';
import { resetDatabase, getDatabaseUrl } from './helpers/db-reset';
import { ensureAuthFile, getAuthFilePath } from './helpers/auth';

const CREATED_TITLE = 'E2E Created Snippet';
const UPDATED_TITLE = 'E2E Updated Snippet';
const ARCHIVED_TITLE = 'E2E Archived Snippet';

async function createReviewSubmission(): Promise<number> {
  const sql = postgres(getDatabaseUrl());
  const [checkpoint] = await sql`
    SELECT c.id
    FROM checkpoints c
    JOIN users u ON c.student_id = u.id
    WHERE c.name = 'Proposal' AND u.email = 'student@e2e.test'
  `;

  if (!checkpoint) {
    await sql.end();
    throw new Error('E2E Proposal checkpoint was not seeded.');
  }

  await sql`DELETE FROM reviews WHERE submission_id IN (SELECT id FROM submissions WHERE checkpoint_id = ${checkpoint.id})`;
  await sql`DELETE FROM submissions WHERE checkpoint_id = ${checkpoint.id}`;

  const [submission] = await sql`
    INSERT INTO submissions (checkpoint_id, uploaded_by, file_key, file_name, file_size, version)
    VALUES (
      ${checkpoint.id},
      (SELECT id FROM users WHERE email = 'student@e2e.test'),
      'feedback-snippets-e2e-file-key',
      'feedback-snippets-e2e.pdf',
      1024,
      1
    )
    RETURNING id
  `;
  await sql`UPDATE checkpoints SET state = 'submitted' WHERE id = ${checkpoint.id}`;
  await sql.end();

  return submission.id;
}

async function openRolePage(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

test.describe('Instructor Feedback Snippets', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ browser }) => {
    await resetDatabase();
    await Promise.all([
      ensureAuthFile(browser, 'instructor'),
      ensureAuthFile(browser, 'instructor2'),
      ensureAuthFile(browser, 'admin'),
      ensureAuthFile(browser, 'student'),
    ]);
  });

  test.use({ storageState: getAuthFilePath('instructor') });

  test('instructor can create, search, edit, archive, and restore a snippet', async ({ page }) => {
    await openRolePage(page, '/instructor/feedback-snippets');

    await expect(page.getByRole('heading', { name: 'Feedback Snippets' })).toBeVisible();
    await expect(page.getByText(ARCHIVED_TITLE, { exact: true })).not.toBeVisible();

    await page.getByTestId('feedback-snippets-create').click();
    await page.getByLabel('Title', { exact: true }).fill(CREATED_TITLE);
    await page.getByLabel('Category', { exact: true }).fill('Clarity');
    await page.getByLabel('Feedback', { exact: true }).fill('Add a clearer explanation.');
    await page.getByTestId('feedback-snippet-submit').click();

    await expect(page.getByRole('status')).toContainText('created');
    const createdCard = page.locator('article').filter({ hasText: CREATED_TITLE });
    await expect(createdCard).toBeVisible();

    await page.getByPlaceholder('Search by title or category...').fill(CREATED_TITLE);
    await expect(createdCard).toBeVisible();
    await expect(page.getByText('E2E Evidence Reminder', { exact: true })).not.toBeVisible();
    await page.getByPlaceholder('Search by title or category...').fill('');

    await createdCard.getByRole('button', { name: `Edit ${CREATED_TITLE}` }).click();
    await page.getByLabel('Title', { exact: true }).fill(UPDATED_TITLE);
    await page.getByTestId('feedback-snippet-submit').click();
    await expect(page.getByRole('status')).toContainText('updated');

    const updatedCard = page.locator('article').filter({ hasText: UPDATED_TITLE });
    await expect(updatedCard).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await updatedCard.getByRole('button', { name: `Archive ${UPDATED_TITLE}` }).click();
    await expect(updatedCard).not.toBeVisible();

    await page.getByTestId('feedback-snippets-archived-filter').click();
    await expect(updatedCard).toBeVisible();
    await updatedCard.getByRole('button', { name: `Restore ${UPDATED_TITLE}` }).click();
    await expect(page.getByText('Feedback snippet restored.', { exact: true })).toBeVisible();
    await page.getByTestId('feedback-snippets-active-filter').click();
    await expect(updatedCard).toBeVisible();
  });

  test('archived snippets stay out of active review insertion', async ({ page }) => {
    const submissionId = await createReviewSubmission();
    await openRolePage(page, `/instructor/reviews/${submissionId}`);

    await expect(page.locator('#comment')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: new RegExp(ARCHIVED_TITLE) })).not.toBeVisible();

    await page.locator('#comment').fill('Manual review note');
    await page.getByRole('button', { name: /E2E Evidence Reminder/ }).click();
    await page.getByRole('button', { name: 'Insert into comment' }).click();

    const comment = page.locator('#comment');
    await expect(comment).toHaveValue(
      'Manual review note\n\nSupport each claim with specific evidence.',
    );
    await comment.fill(`${await comment.inputValue()} Edited`);
    await expect(comment).toHaveValue(/Edited$/);
    await expect(page.locator('input[name="decision"]').first()).not.toBeChecked();
    await expect(page.getByRole('button', { name: 'Submit Review' })).toBeVisible();
  });

  test('instructor only sees their own snippets', async ({ browser }) => {
    const context = await browser.newContext({ storageState: getAuthFilePath('instructor2') });
    const page = await context.newPage();

    try {
      await openRolePage(page, '/instructor/feedback-snippets');
      await expect(page.getByText('Instructor Two Private Snippet', { exact: true })).toBeVisible();
      await expect(page.getByText(UPDATED_TITLE, { exact: true })).not.toBeVisible();
      await page.getByPlaceholder('Search by title or category...').fill(UPDATED_TITLE);
      await expect(page.getByText(UPDATED_TITLE, { exact: true })).not.toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('students and admins are redirected away from the instructor-only route', async ({
    browser,
  }) => {
    for (const role of ['student', 'admin'] as const) {
      const context = await browser.newContext({ storageState: getAuthFilePath(role) });
      const page = await context.newPage();

      try {
        await openRolePage(page, '/instructor/feedback-snippets');
        await expect(page).toHaveURL(new RegExp(`/${role}/dashboard$`));
      } finally {
        await context.close();
      }
    }
  });
});
