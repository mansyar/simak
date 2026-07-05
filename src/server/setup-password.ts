import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

export const SetupPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export type PasswordSetupResult = { success: true } | { error: string };

export async function completePasswordSetupHandler(args: {
  data: { token: string; password: string };
}): Promise<PasswordSetupResult> {
  const { token, password } = args.data;

  if (!token || !password || password.length < 8) {
    return { error: 'Invalid token or password' };
  }

  // Dynamic import to avoid bundling server-only deps on the client
  const { eq, and, gt, isNull } = await import('drizzle-orm');
  const { getDb } = await import('../db/index');
  const { verification, account, users } = await import('../db/schema/index');
  const { hashPassword } = await import('better-auth/crypto');
  const crypto = await import('node:crypto');

  const db = getDb();

  // Hash the password outside the transaction — it is CPU-bound and does not touch the database.
  // If hashing fails, the token has not yet been consumed and nothing needs to roll back.
  const hashedPassword = await hashPassword(password);

  try {
    return await db.transaction(async (tx) => {
      // Atomic consume-once token validation: DELETE the token only if it exists and has not expired.
      // Concurrent requests with the same token will race on this row; exactly one will DELETE it.
      const consumed = await tx
        .delete(verification)
        .where(and(eq(verification.value, token), gt(verification.expiresAt, new Date())))
        .returning();

      if (consumed.length === 0) {
        return { error: 'Invalid or expired token' };
      }

      const email = consumed[0].identifier;

      // Find the user by email inside the transaction so the token is only consumed if the user exists.
      const user = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, email), isNull(users.deletedAt)))
        .limit(1)
        .then((rows) => rows[0]);

      if (!user) {
        throw new Error('User not found during password setup');
      }

      // Upsert the account with the password
      const existingAccount = await tx
        .select({ id: account.id })
        .from(account)
        .where(eq(account.userId, user.id))
        .limit(1)
        .then((rows) => rows[0]);

      if (existingAccount) {
        await tx
          .update(account)
          .set({ password: hashedPassword, updatedAt: new Date() })
          .where(eq(account.id, existingAccount.id));
      } else {
        await tx.insert(account).values({
          id: crypto.default.randomUUID(),
          userId: user.id,
          accountId: user.id,
          providerId: 'credential',
          password: hashedPassword,
        });
      }

      // Update emailVerified on the user
      await tx
        .update(users)
        .set({ emailVerified: true, updatedAt: new Date() })
        .where(eq(users.id, user.id));

      return { success: true };
    });
  } catch (err) {
    console.error('completePasswordSetupHandler failed:', err);
    return { error: 'Internal Server Error' };
  }
}

export const completePasswordSetup = createServerFn({ method: 'POST' })
  .inputValidator(SetupPasswordSchema)
  .handler(async ({ data }) => {
    return completePasswordSetupHandler({ data });
  });
