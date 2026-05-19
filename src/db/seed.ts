import { eq } from 'drizzle-orm';
import { getDb } from './index';
import { users } from './schema/index';

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
  const { email } = validateEnv();
  const db = getDb();

  // Idempotency: skip if user already exists
  const existing = await db.select().from(users).where(eq(users.email, email));

  if (existing.length > 0) {
    console.log(`SuperAdmin user already exists (${email}). Skipping.`);
    return;
  }

  await db.insert(users).values({
    name: 'SuperAdmin',
    email,
    role: 'superadmin',
    locale: 'en',
  });

  console.log(`SuperAdmin user created (${email}).`);
}

// Allow running directly: `tsx src/db/seed.ts`
const isMainModule = process.argv[1]?.endsWith('seed.ts');
if (isMainModule) {
  seedSuperAdmin()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
