import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TABLES_TO_TRUNCATE } from './helpers/db-reset';

/**
 * Global setup runs once before all tests.
 * 1. Run Drizzle migrations on the test database
 * 2. Truncate all application tables (clean slate from previous runs)
 * 3. Seed deterministic test data
 * 4. Create placeholder storageState files so workers can start
 *    (real auth files are created by each spec's beforeAll)
 */
export default async function globalSetup() {
  const connectionString = process.env.DATABASE_URL!;

  // 1. Run migrations
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: './drizzle/migrations' });

  // 2. Truncate all tables (clean slate from previous test runs)
  const truncateQuery = `TRUNCATE ${TABLES_TO_TRUNCATE.join(', ')} CASCADE;`;
  await sql.unsafe(truncateQuery);
  await sql.end();

  // 3. Seed test data
  execSync('npx tsx scripts/seed-e2e.ts', { stdio: 'inherit' });

  // 4. Create placeholder storageState files
  //    test.use({ storageState: 'path' }) requires the file to exist
  //    when the worker starts. beforeAll in each spec will overwrite
  //    these with real authenticated sessions.
  const authDir = join(process.cwd(), 'tests', 'e2e', '.auth');
  mkdirSync(authDir, { recursive: true });
  const placeholder = JSON.stringify({ cookies: [], origins: [] });
  for (const role of ['admin', 'instructor', 'student', 'superadmin']) {
    writeFileSync(join(authDir, `${role}.json`), placeholder);
  }
}
