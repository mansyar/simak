import { test, expect } from '@playwright/test';
import postgres from 'postgres';
import { resetDatabase, getDatabaseUrl } from './helpers/db-reset';
import { ensureAuthFile, getAuthFilePath } from './helpers/auth';

test.describe('Admin Template Management', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ browser }) => {
    await resetDatabase();
    await ensureAuthFile(browser, 'admin');
  });

  test.use({ storageState: getAuthFilePath('admin') });

  async function getTemplateIdByName(name: string): Promise<number> {
    const sql = postgres(getDatabaseUrl());
    const [row] = await sql`
      SELECT id FROM assignment_templates
      WHERE name = ${name} AND deleted_at IS NULL
      LIMIT 1
    `;
    await sql.end();
    return row?.id;
  }

  test('admin creates a template with checkpoints', async ({ page }) => {
    await page.goto('/admin/templates');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'New Template' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByPlaceholder('e.g., Thesis Template').fill('E2E Created Template');
    await dialog.getByPlaceholder('e.g., Thesis, Research Paper').fill('Research Paper');

    await dialog.getByTestId('checkpoint-input-0').fill('Introduction');
    await dialog.getByTestId('checkpoint-input-1').fill('Methodology');
    await dialog.getByTestId('checkpoint-input-2').fill('Conclusion');

    await dialog.locator('form').evaluate((form) => (form as HTMLFormElement).requestSubmit());

    await page.waitForURL(/\/admin\/templates\/\d+/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    await page.goto('/admin/templates');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('E2E Created Template').first()).toBeVisible();
  });

  test('admin edits a template and changes persist after reload', async ({ page }) => {
    const templateId = await getTemplateIdByName('E2E Thesis Template');
    expect(templateId).toBeDefined();

    await page.goto(`/admin/templates/${templateId}`);
    await page.waitForLoadState('networkidle');

    const nameInput = page.getByTestId('template-name');
    await nameInput.clear();
    await nameInput.fill('E2E Edited Template');

    await page.getByTestId('save-template').click();

    await expect(page.getByText('Template saved')).toBeVisible({ timeout: 10000 });

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('template-name')).toHaveValue('E2E Edited Template');
  });

  test('admin duplicates a template and (Copy) suffix appears', async ({ page }) => {
    await page.goto('/admin/templates');
    await page.waitForLoadState('networkidle');

    const card = page
      .locator('[data-slot="card"]', {
        has: page.getByText('E2E Edited Template', { exact: true }),
      })
      .first();
    await card.getByRole('button', { name: 'Open menu' }).click();

    await page.getByRole('menuitem', { name: 'Duplicate' }).click();

    await expect(page.getByText('E2E Edited Template (Copy)')).toBeVisible({ timeout: 15000 });
  });

  test('admin cannot delete a template in use without typing DELETE', async ({ page }) => {
    await page.goto('/admin/templates');
    await page.waitForLoadState('networkidle');

    const card = page
      .locator('[data-slot="card"]', {
        has: page.getByText('E2E Edited Template', { exact: true }),
      })
      .first();
    await card.getByRole('button', { name: 'Open menu' }).click();

    await page.getByRole('menuitem', { name: 'Delete' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await expect(dialog.getByText(/used by 1 assignment/i)).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Delete' })).toBeDisabled();

    await dialog.getByTestId('delete-input').fill('DELETE');
    await expect(dialog.getByRole('button', { name: 'Delete' })).toBeEnabled();

    await dialog.getByRole('button', { name: 'Cancel' }).click();
  });

  test('admin deletes an unused template with confirmation', async ({ page }) => {
    await page.goto('/admin/templates');
    await page.waitForLoadState('networkidle');

    const card = page
      .locator('[data-slot="card"]', {
        has: page.getByText('E2E Edited Template (Copy)'),
      })
      .first();
    await card.getByRole('button', { name: 'Open menu' }).click();

    await page.getByRole('menuitem', { name: 'Delete' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await expect(dialog.getByRole('button', { name: 'Delete' })).toBeEnabled();

    await dialog.getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByText('E2E Edited Template (Copy)')).not.toBeVisible({ timeout: 15000 });
  });
});
