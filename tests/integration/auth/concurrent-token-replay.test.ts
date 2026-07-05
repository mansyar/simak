/** @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import { verifyPassword } from 'better-auth/crypto';
import { getDb } from '@/db/index';
import { users, verification, account } from '@/db/schema/index';
import { completePasswordSetupHandler } from '@/server/setup-password';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

describe('completePasswordSetupHandler atomic token consumption', () => {
  const db = getDb();
  const timestamp = Date.now();
  const userId = `setup-user-${timestamp}`;
  const email = `setup-user-${timestamp}@test.com`;
  const token = `setup-token-${timestamp}`;
  const passwordA = 'password-alpha-1';
  const passwordB = 'password-beta-2';

  beforeEach(async () => {
    await db.insert(users).values({
      id: userId,
      name: 'Setup Token User',
      email,
      role: 'student',
    });
  });

  afterEach(async () => {
    await db.delete(account).where(eq(account.userId, userId));
    await db.delete(verification).where(eq(verification.value, token));
    await db.delete(users).where(eq(users.id, userId));
  });

  it('prevents concurrent token replay: exactly one request succeeds', async () => {
    await db.insert(verification).values({
      id: crypto.randomUUID(),
      identifier: email,
      value: token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const [resultA, resultB] = await Promise.all([
      completePasswordSetupHandler({ data: { token, password: passwordA } }),
      completePasswordSetupHandler({ data: { token, password: passwordB } }),
    ]);

    const successes = [resultA, resultB].filter(
      (r) => (r as { success?: boolean }).success === true,
    );
    const failures = [resultA, resultB].filter((r) => (r as { error?: unknown }).error);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const winnerPassword =
      (resultA as { success?: boolean }).success === true ? passwordA : passwordB;

    const accounts = await db
      .select({ password: account.password })
      .from(account)
      .where(eq(account.userId, userId));

    expect(accounts).toHaveLength(1);
    expect(accounts[0].password).not.toBeNull();
    const passwordHash = accounts[0].password as string;

    expect(await verifyPassword({ hash: passwordHash, password: winnerPassword })).toBe(true);
    expect(
      await verifyPassword({
        hash: passwordHash,
        password: winnerPassword === passwordA ? passwordB : passwordA,
      }),
    ).toBe(false);

    const remainingTokens = await db
      .select({ id: verification.id })
      .from(verification)
      .where(eq(verification.value, token));
    expect(remainingTokens).toHaveLength(0);
  });

  it('rejects an expired token and leaves the row in the database', async () => {
    await db.insert(verification).values({
      id: crypto.randomUUID(),
      identifier: email,
      value: token,
      expiresAt: new Date(Date.now() - 1000),
    });

    const result = await completePasswordSetupHandler({
      data: { token, password: passwordA },
    });

    expect(result).toEqual({ error: 'Invalid or expired token' });

    const remainingTokens = await db
      .select({ id: verification.id })
      .from(verification)
      .where(eq(verification.value, token));
    expect(remainingTokens).toHaveLength(1);
  });

  it('rolls back the consumed token when the user is not found', async () => {
    await db.insert(verification).values({
      id: crypto.randomUUID(),
      identifier: 'missing-user@example.com',
      value: token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const result = await completePasswordSetupHandler({
      data: { token, password: passwordA },
    });

    expect(result).toEqual({ error: 'Internal Server Error' });

    const remainingTokens = await db
      .select({ id: verification.id })
      .from(verification)
      .where(eq(verification.value, token));
    expect(remainingTokens).toHaveLength(1);
  });

  it('allows only the first sequential call to consume the token', async () => {
    await db.insert(verification).values({
      id: crypto.randomUUID(),
      identifier: email,
      value: token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const first = await completePasswordSetupHandler({
      data: { token, password: passwordA },
    });
    expect(first).toEqual({ success: true });

    const second = await completePasswordSetupHandler({
      data: { token, password: passwordB },
    });
    expect(second).toEqual({ error: 'Invalid or expired token' });

    const remainingTokens = await db
      .select({ id: verification.id })
      .from(verification)
      .where(eq(verification.value, token));
    expect(remainingTokens).toHaveLength(0);
  });
});
