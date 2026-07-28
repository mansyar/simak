// Server-only handlers (not imported by client code)
import { eq, and, gt, isNull } from 'drizzle-orm';
import { getDb } from '../db/index';
import { verification, account, users } from '../db/schema/index';
import { hashPassword } from 'better-auth/crypto';
import { randomUUID } from 'node:crypto';
import { serverError, ErrorCode, type ServerError } from '@/lib/errors';
import type { z } from 'zod';
import type { SetupPasswordSchema } from './setup-password';

type SetupPasswordInput = z.infer<typeof SetupPasswordSchema>;

export type PasswordSetupResult = { success: true } | ServerError;

export async function completePasswordSetupHandler(args: {
  data: SetupPasswordInput;
}): Promise<PasswordSetupResult> {
  const { token, password } = args.data;

  if (!token || !password || password.length < 8) {
    return serverError(ErrorCode.BAD_REQUEST, 'Invalid token or password', {
      handler: 'completePasswordSetupHandler',
    });
  }

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
        return serverError(ErrorCode.NOT_FOUND, 'Invalid or expired token', {
          handler: 'completePasswordSetupHandler',
        });
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
          id: randomUUID(),
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
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err,
      handler: 'completePasswordSetupHandler',
    });
  }
}
