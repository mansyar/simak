import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema/index';
let _db = null;
export function getDb() {
  if (_db) return _db;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required.');
  }
  const client = postgres(databaseUrl);
  _db = drizzle(client, { schema });
  return _db;
}
/**
 * Singleton db instance — lazy-loaded.
 * Use for read queries. For writes, prefer getDb() with explicit tx.
 */
function createLazyDb() {
  let instance = null;
  return new Proxy(
    {},
    {
      get(_, prop) {
        if (!instance) instance = getDb();
        return Reflect.get(instance, prop, instance);
      },
    },
  );
}
export const db = createLazyDb();
