import { createServerFn } from '@tanstack/react-start';

export const completePasswordSetup = createServerFn({ method: 'POST' }).handler(
  async (args: { data: any }) => {
    const { token, password } = args.data as { token: string; password: string };

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

    // Find the verification record
    const verificationRecord = await db
      .select()
      .from(verification)
      .where(and(eq(verification.value, token), gt(verification.expiresAt, new Date())))
      .limit(1)
      .then((rows) => rows[0]);

    if (!verificationRecord) {
      return { error: 'Invalid or expired token' };
    }

    const email = verificationRecord.identifier;

    // Find the user by email
    const user = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!user) {
      return { error: 'User not found' };
    }

    // Hash the password
    const hashedPassword = await hashPassword(password);

    // Upsert the account with the password
    const existingAccount = await db
      .select({ id: account.id })
      .from(account)
      .where(eq(account.userId, user.id))
      .limit(1)
      .then((rows) => rows[0]);

    if (existingAccount) {
      await db
        .update(account)
        .set({ password: hashedPassword, updatedAt: new Date() })
        .where(eq(account.id, existingAccount.id));
    } else {
      await db.insert(account).values({
        id: crypto.default.randomUUID(),
        userId: user.id,
        accountId: user.id,
        providerId: 'credential',
        password: hashedPassword,
      });
    }

    // Update emailVerified on the user
    await db
      .update(users)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    // Delete the used verification token
    await db.delete(verification).where(eq(verification.id, verificationRecord.id));

    return { success: true };
  },
);
