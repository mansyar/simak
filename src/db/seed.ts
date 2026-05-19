import { eq } from 'drizzle-orm';
import { getDb } from './index';
import { users, account } from './schema/index';
import { hashPassword } from 'better-auth/crypto';
import crypto from 'node:crypto';

/**
 * Validate seed environment variables.
 * Throws with a descriptive message if validation fails.
 */
function validateEnv(): { email: string; password: string } {
  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD environment variables are required.');
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    throw new Error(`Invalid email format: ${email}`);
  }

  if (password.length < 8) {
    throw new Error('SUPERADMIN_PASSWORD must be at least 8 characters long.');
  }

  return { email, password };
}

/**
 * Seed a SuperAdmin user using SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD
 * environment variables. Idempotent — safe to run multiple times.
 */
export async function seedSuperAdmin(): Promise<void> {
  const { email, password } = validateEnv();
  const db = getDb();

  // Idempotency: skip if user already exists
  const existing = await db.select().from(users).where(eq(users.email, email));

  if (existing.length > 0) {
    console.log(`SuperAdmin user already exists (${email}). Skipping.`);
    return;
  }

  const userId = crypto.randomUUID();

  // Create the user record
  await db.insert(users).values({
    id: userId,
    name: 'SuperAdmin',
    email,
    role: 'superadmin',
    locale: 'en',
  });

  // Create the account record with hashed password (Better-Auth credential provider)
  const hashedPassword = await hashPassword(password);
  await db.insert(account).values({
    id: crypto.randomUUID(),
    userId,
    accountId: userId,
    providerId: 'credential',
    password: hashedPassword,
  });

  console.log(`SuperAdmin user created (${email}).`);
}

export async function seedTestUsers(): Promise<void> {
  const db = getDb();
  const testPassword = process.env.TEST_USER_PASSWORD || 'password';
  const hashedPassword = await hashPassword(testPassword);

  const testUsers = [
    { name: 'Instructor', email: 'instructor@simak.app', role: 'instructor' as const },
    { name: 'Student', email: 'student@simak.app', role: 'student' as const },
  ];

  for (const u of testUsers) {
    const existing = await db.select().from(users).where(eq(users.email, u.email));
    if (existing.length > 0) {
      console.log(`Test user already exists (${u.email}). Skipping.`);
      continue;
    }

    const userId = crypto.randomUUID();

    await db.insert(users).values({
      id: userId,
      name: u.name,
      email: u.email,
      role: u.role,
      emailVerified: true,
      locale: 'en',
    });

    await db.insert(account).values({
      id: crypto.randomUUID(),
      userId,
      accountId: userId,
      providerId: 'credential',
      password: hashedPassword,
    });

    console.log(`Test user created: ${u.name} (${u.email}) / ${testPassword}`);
  }
}

// Allow running directly: `tsx src/db/seed.ts`
const isMainModule = process.argv[1]?.endsWith('seed.ts');
if (isMainModule) {
  seedSuperAdmin()
    .then(() => seedTestUsers())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
