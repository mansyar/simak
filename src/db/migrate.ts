import { execSync } from 'node:child_process';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';

export const ADVISORY_LOCK_ID = 789123;

export async function runMigrations() {
  const connectionString = process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(
      'MIGRATE_DATABASE_URL or DATABASE_URL environment variable is required',
      'Set at least one to connect to PostgreSQL.',
    );
    process.exit(1);
  }

  const postgresClient = postgres(connectionString, { max: 1, onnotice: () => {} });
  const db = drizzle(postgresClient);

  console.log('Acquiring advisory lock...');
  await db.execute(sql`SELECT pg_advisory_lock(${sql.raw(String(ADVISORY_LOCK_ID))})`);

  try {
    console.log('Running migrations via drizzle-kit...');
    execSync('npx drizzle-kit migrate', { stdio: 'inherit' });
    console.log('Migrations complete.');
  } finally {
    console.log('Releasing advisory lock...');
    await db.execute(sql`SELECT pg_advisory_unlock(${sql.raw(String(ADVISORY_LOCK_ID))})`);
  }

  await postgresClient.end();
}

// Only run when executed directly (not imported by tests)
// Cross-platform: match by filename suffix (works with relative/absolute paths)
const isDirectExecution =
  process.argv[1] &&
  (process.argv[1].endsWith('migrate.ts') || process.argv[1].endsWith('migrate.mjs'));
if (isDirectExecution) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
