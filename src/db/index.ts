import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = PostgresJsDatabase<any>;

let _db: Db | null = null;

export function getDb(): Db {
  if (_db) return _db;

  const client = postgres(process.env.DATABASE_URL!);
  _db = drizzle(client);
  return _db;
}

/** Singleton db instance — use for read queries. For writes, prefer getDb() with explicit tx. */
export const db = getDb();
