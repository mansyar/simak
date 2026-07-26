import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { resetDatabase, getDatabaseUrl } from './helpers/db-reset';
import { ensureAuthFile, getAuthFilePath } from './helpers/auth';

// ─── DB Helpers ─────────────────────────────────────────────────────────────

async function getVerificationToken(email: string): Promise<string> {
  const sql = postgres(getDatabaseUrl());
  const [row] = await sql`
    SELECT value FROM verification
    WHERE identifier = ${email}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  await sql.end();
  if (!row) throw new Error(`No verification token found for ${email}`);
  return row.value;
}

async function createTestUser(name: string, email: string, role: string): Promise<string> {
  const sql = postgres(getDatabaseUrl());
  const id = randomUUID();
  await sql`
    INSERT INTO users (id, name, email, role)
    VALUES (${id}, ${name}, ${email}, ${role})
  `;
  await sql.end();
  return id;
}

async function insertVerificationToken(email: string, expiresAt: Date): Promise<string> {
  const sql = postgres(getDatabaseUrl());
  const token = randomUUID();
  const id = randomUUID();
  await sql`
    INSERT INTO verification (id, identifier, value, expires_at)
    VALUES (${id}, ${email}, ${token}, ${expiresAt})
  `;
  await sql.end();
  return token;
}

async function loginWithCredentials(
  page: Page,
  email: string,
  password: string,
  dashboardPath: string,
): Promise<void> {
  await page.goto('/auth/login');
  await page.waitForLoadState('networkidle');
  await page.fill('#email', email);
  await page.fill('#password', password);

  const response = await page.evaluate(
    async (credentials) => {
      const res = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(credentials),
      });
      return { ok: res.ok, status: res.status };
    },
    { email, password },
  );

  if (!response.ok) {
    throw new Error(`Login failed for ${email}: API returned ${response.status}`);
  }

  await page.goto(dashboardPath);
  await page.waitForURL(`**${dashboardPath}**`, { timeout: 30_000 });
}

async function fillPasswordFormAndSubmit(page: Page, password: string): Promise<void> {
  await page.locator('#password').fill(password);
  await page.locator('#confirmPassword').fill(password);
  await page.locator('button[type="submit"]').click();
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test.describe('Password Setup Lifecycle', () => {
  test.beforeAll(async ({ browser }) => {
    await resetDatabase();
    await ensureAuthFile(browser, 'admin');
  });

  test('admin creates user → password setup → login with new credentials', async ({ browser }) => {
    const testEmail = `setup-user@e2e.test`;
    const testPassword = 'NewPass123!';

    // === Step 1: Admin creates user via create-user dialog ===
    const adminCtx = await browser.newContext({ storageState: getAuthFilePath('admin') });
    const adminPage = await adminCtx.newPage();

    await adminPage.goto('/admin/users');
    await adminPage.waitForLoadState('networkidle');

    await adminPage.getByRole('button', { name: 'New User' }).click();
    const dialog = adminPage.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    await dialog.locator('input[name="name"]').fill('Setup Test User');
    await dialog.locator('input[name="email"]').fill(testEmail);
    await dialog.locator('button[role="combobox"]').click();
    await adminPage.getByRole('option', { name: 'Student' }).click();

    // Submit via requestSubmit (Base UI Button defaults to type=button)
    await dialog.locator('form').evaluate((form) => (form as HTMLFormElement).requestSubmit());
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });
    await expect(adminPage.locator('table')).toContainText(testEmail, { timeout: 10_000 });
    await adminCtx.close();

    // === Step 2: Extract token from DB ===
    const token = await getVerificationToken(testEmail);
    expect(token).toBeTruthy();

    // === Step 3: Navigate to setup-password page (unauthenticated) ===
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`/auth/setup-password?token=${token}`);
    await page.waitForLoadState('networkidle');

    // Verify the form is visible
    await expect(page.locator('h1')).toContainText('Set Up Your Password');

    // === Step 4: Fill and submit password setup form ===
    await fillPasswordFormAndSubmit(page, testPassword);

    // === Step 5: Verify success page ===
    await expect(page.locator('h1')).toContainText('Password set successfully', {
      timeout: 10_000,
    });

    // === Step 6: Login with new credentials ===
    await loginWithCredentials(page, testEmail, testPassword, '/student/dashboard');

    // === Step 7: Verify dashboard access ===
    await expect(page).toHaveURL(/\/student\/dashboard/);
    await ctx.close();
  });

  test('token reuse after setup → Invalid or expired token error', async ({ browser }) => {
    const testEmail = `reuse-token@e2e.test`;
    const testPassword = 'NewPass123!';

    // Create user and valid token via DB
    await createTestUser('Reuse Token User', testEmail, 'student');
    const token = await insertVerificationToken(testEmail, new Date(Date.now() + 60 * 60 * 1000));

    // === First use: complete password setup (success) ===
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`/auth/setup-password?token=${token}`);
    await page.waitForLoadState('networkidle');

    await fillPasswordFormAndSubmit(page, testPassword);
    await expect(page.locator('h1')).toContainText('Password set successfully', {
      timeout: 10_000,
    });

    // === Second use: try the same token again (should fail) ===
    await page.goto(`/auth/setup-password?token=${token}`);
    await page.waitForLoadState('networkidle');

    await fillPasswordFormAndSubmit(page, testPassword);

    // Verify error message appears
    await expect(page.getByRole('alert')).toContainText('Invalid or expired token', {
      timeout: 10_000,
    });
    await ctx.close();
  });

  test('expired token → Invalid or expired token error', async ({ browser }) => {
    const testEmail = `expired-token@e2e.test`;
    const testPassword = 'NewPass123!';

    // Create user and expired token via DB
    await createTestUser('Expired Token User', testEmail, 'student');
    const token = await insertVerificationToken(testEmail, new Date(Date.now() - 60 * 60 * 1000));

    // Navigate to setup-password with expired token
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`/auth/setup-password?token=${token}`);
    await page.waitForLoadState('networkidle');

    // Form should appear (token is in URL)
    await expect(page.locator('h1')).toContainText('Set Up Your Password');

    // Fill and submit
    await fillPasswordFormAndSubmit(page, testPassword);

    // Verify error message appears
    await expect(page.getByRole('alert')).toContainText('Invalid or expired token', {
      timeout: 10_000,
    });
    await ctx.close();
  });
});
