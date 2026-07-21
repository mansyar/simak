import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { execSync } from 'node:child_process';

/**
 * Global setup runs once before all tests.
 * 1. Run Drizzle migrations on the test database
 * 2. Seed deterministic test data
 */
export default async function globalSetup() {
  const connectionString = process.env.DATABASE_URL!;

  // 1. Run migrations
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: './drizzle/migrations' });
  await sql.end();

  // 2. Seed test data
  execSync('npx tsx scripts/seed-e2e.ts', { stdio: 'inherit' });
}
