import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema/index';

export type Db = PostgresJsDatabase<typeof schema>;

let _db: Db | null = null;

export function getDb(): Db {
  if (_db) return _db;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required.');
  }

  const client = postgres(databaseUrl);
  _db = drizzle(client, { schema });
  return _db;
}

/** Singleton db instance — use for read queries. For writes, prefer getDb() with explicit tx. */
export const db = getDb();
