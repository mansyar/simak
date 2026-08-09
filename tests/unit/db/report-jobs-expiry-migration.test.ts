import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsDir = join(process.cwd(), 'drizzle', 'migrations');

const norm = (sql: string) => sql.replace(/\s+/g, ' ');

describe('report job expiry constraint migrations', () => {
  const forward = readFileSync(join(migrationsDir, '0032_little_moon_knight.sql'), 'utf8');

  it('0032 relaxes the expired branch to retain artifact metadata', () => {
    expect(norm(forward)).toContain(
      '"report_jobs"."artifact_key" IS NOT NULL AND "report_jobs"."artifact_size_bytes" > 0 ' +
        'AND "report_jobs"."artifact_sha256" IS NOT NULL',
    );
  });

  it('has a companion rollback that restores the null artifact key requirement', () => {
    const rollback = readFileSync(
      join(migrationsDir, 'rollback', '0032_little_moon_knight.rollback.sql'),
      'utf8',
    );
    const normalized = norm(rollback);
    expect(normalized).toContain(
      '"report_jobs"."artifact_key" IS NULL AND "report_jobs"."failure_code" IS NULL',
    );
    const dropIdx = normalized.indexOf('DROP CONSTRAINT');
    const addIdx = normalized.indexOf('ADD CONSTRAINT');
    expect(dropIdx).toBeGreaterThanOrEqual(0);
    expect(addIdx).toBeGreaterThan(dropIdx);
  });

  it('keeps recent journal timestamps strictly monotonic so migrations are never skipped', () => {
    const journal = JSON.parse(
      readFileSync(join(migrationsDir, 'meta', '_journal.json'), 'utf8'),
    ) as { entries: { when: number }[] };
    const tail = journal.entries.slice(-4);
    for (let i = 1; i < tail.length; i += 1) {
      expect(tail[i].when).toBeGreaterThan(tail[i - 1].when);
    }
  });
});
