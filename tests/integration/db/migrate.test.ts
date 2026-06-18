/** @vitest-environment node */
import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { getDb } from '@/db/index';
import { sql } from 'drizzle-orm';

const DB_URL = 'postgresql://simak:simak_password@localhost:5432/simak';
const MIGRATE_BIN = path.resolve('.output/server/migrate.mjs');
const SEED_BIN = path.resolve('.output/server/seed.mjs');

const SUPERADMIN_EMAIL = 'superadmin-integration-test@simak.app';
const SUPERADMIN_PASSWORD = 'TestPassword123!';

/**
 * Drop all tables and schemas to simulate a fresh database.
 * Targets both `public` (application tables + types) and `drizzle` (migration tracking).
 */
async function resetDatabase() {
  const db = getDb();

  // Drop all tables in public schema (cascades to dependent types)
  await db.execute(sql`DO $$ DECLARE
    r RECORD;
  BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
      EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
  END $$;`);

  // Drop custom enum types that survive table drops
  await db.execute(sql`DO $$ DECLARE
    r RECORD;
  BEGIN
    FOR r IN (SELECT typname FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid
              WHERE n.nspname = 'public' AND t.typtype = 'e') LOOP
      EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
    END LOOP;
  END $$;`);

  // Drop drizzle schema (migration tracking)
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
}

describe('Migration Runner Integration', () => {
  beforeAll(async () => {
    await resetDatabase();
  }, 30_000);

  it('AC-2: migrate.mjs applies all migrations and exits 0', () => {
    const result = execFileSync('node', [MIGRATE_BIN], {
      env: {
        ...process.env,
        DATABASE_URL: DB_URL,
      },
      encoding: 'utf-8',
      timeout: 30_000,
    });

    // migrate.mjs shells out to `drizzle-kit migrate`
    // If we reach here, it exited 0
    expect(result).toBeDefined();
  }, 30_000);

  it('AC-2: migration row present in __drizzle_migrations', async () => {
    const db = getDb();
    const rows = await db.execute(sql`SELECT COUNT(*) as count FROM drizzle.__drizzle_migrations`);
    const count = Number(rows[0].count);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('AC-3: idempotent re-run creates no new migration rows', async () => {
    // Get current count
    const db = getDb();
    const before = await db.execute(
      sql`SELECT COUNT(*) as count FROM drizzle.__drizzle_migrations`,
    );
    const countBefore = Number(before[0].count);

    // Run migrate.mjs a second time
    const result = execFileSync('node', [MIGRATE_BIN], {
      env: {
        ...process.env,
        DATABASE_URL: DB_URL,
      },
      encoding: 'utf-8',
      timeout: 30_000,
    });

    expect(result).toBeDefined();

    // Verify no new rows
    const after = await db.execute(sql`SELECT COUNT(*) as count FROM drizzle.__drizzle_migrations`);
    const countAfter = Number(after[0].count);
    expect(countAfter).toBe(countBefore);
  }, 30_000);

  it('AC-6: seed.mjs creates SuperAdmin on first run', () => {
    const result = execFileSync('node', [SEED_BIN], {
      env: {
        ...process.env,
        DATABASE_URL: DB_URL,
        SUPERADMIN_EMAIL,
        SUPERADMIN_PASSWORD,
      },
      encoding: 'utf-8',
      timeout: 30_000,
    });

    expect(result).toContain('SuperAdmin user created');
  }, 30_000);

  it('AC-6: seed.mjs idempotent — second run skips SuperAdmin', () => {
    const result = execFileSync('node', [SEED_BIN], {
      env: {
        ...process.env,
        DATABASE_URL: DB_URL,
        SUPERADMIN_EMAIL,
        SUPERADMIN_PASSWORD,
      },
      encoding: 'utf-8',
      timeout: 30_000,
    });

    expect(result).toContain('already exists');
  }, 30_000);

  it('AC-6: only one SuperAdmin user in database', async () => {
    const db = getDb();
    const rows = await db.execute(
      sql`SELECT COUNT(*) as count FROM public.users WHERE email = ${SUPERADMIN_EMAIL}`,
    );
    const count = Number(rows[0].count);
    expect(count).toBe(1);
  });
});
