import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('0002_unique_submission_version migration', () => {
  const migrationPath = resolve(
    process.cwd(),
    'drizzle/migrations/0002_unique_submission_version.sql',
  );
  const rollbackPath = resolve(
    process.cwd(),
    'drizzle/migrations/rollback/0002_unique_submission_version.rollback.sql',
  );

  it('exists and defensively deduplicates submissions before adding the unique constraint', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toMatch(/DELETE\s+FROM\s+["']?submissions["']?/i);
    // Dedup must group by BOTH checkpoint_id AND version so that distinct
    // version history (1, 2, 3 ...) is preserved — only exact duplicate
    // (checkpoint_id, version) pairs are removed.
    expect(sql).toMatch(/GROUP\s+BY\s+["']?checkpoint_id["']?\s*,\s*["']?version["']?/is);
    expect(sql).toContain(
      'ALTER TABLE "submissions" ADD CONSTRAINT "submissions_checkpoint_version_unq" UNIQUE ("checkpoint_id", "version")',
    );
  });

  it('has a companion rollback migration that drops the constraint', () => {
    const sql = readFileSync(rollbackPath, 'utf8');
    expect(sql).toContain(
      'ALTER TABLE "submissions" DROP CONSTRAINT IF EXISTS "submissions_checkpoint_version_unq"',
    );
  });
});
