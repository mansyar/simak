import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { getEnv } from '@/config/env';
import { logger } from '@/lib/logger';
import * as schema from './schema/index';

export type Db = PostgresJsDatabase<typeof schema>;

let _db: Db | null = null;

export function getDb(): Db {
  if (_db) return _db;

  const env = getEnv();
  const client = postgres(env.DATABASE_URL, {
    max: env.DB_POOL_MAX,
    idle_timeout: 30,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
    prepare: !env.DB_PREPARED_STATEMENTS_DISABLED,
    onnotice: (notice) => logger.debug({ event: 'pg_notice', ...notice }),
  });
  _db = drizzle(client, { schema });
  return _db;
}

/**
 * Singleton db instance — lazy-loaded.
 * Use for read queries. For writes, prefer getDb() with explicit tx.
 */
function createLazyDb(): Db {
  let instance: Db | null = null;
  return new Proxy({} as Db, {
    get(_, prop) {
      if (!instance) instance = getDb();
      return Reflect.get(instance, prop, instance);
    },
  });
}
export const db = createLazyDb();
