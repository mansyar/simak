/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

function findBackfillMigration() {
  const dir = resolve(__dirname, '../../../drizzle/migrations');
  const files = readdirSync(dir);
  const match = files.find((f) => /^\d{4}_backfill_notifications\.sql$/.test(f));
  return match ? resolve(dir, match) : null;
}

describe('notifications backfill migration', () => {
  it('exists and copies legacy title/message into key columns with empty params', () => {
    const path = findBackfillMigration();
    expect(path).not.toBeNull();

    const sql = readFileSync(path!, 'utf8');
    const lower = sql.toLowerCase();
    expect(lower).toContain('update');
    expect(lower).toContain('notifications');
    expect(lower).toContain('title_key = title');
    expect(lower).toContain('message_key = message');
    expect(lower).toContain("'{}'::jsonb");
  });
});
