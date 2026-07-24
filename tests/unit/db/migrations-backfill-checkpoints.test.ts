/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';

const migrationsDir = resolve(__dirname, '../../../drizzle/migrations');
const rollbackDir = resolve(__dirname, '../../../drizzle/migrations/rollback');

/**
 * Scans migration files for one containing a backfill UPDATE that populates
 * checkpoints.template_checkpoint_id from assignments + template_checkpoints.
 */
function findBackfillMigration(): string | null {
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
  for (const file of files) {
    const sql = readFileSync(resolve(migrationsDir, file), 'utf8');
    // Match: UPDATE checkpoints ... SET template_checkpoint_id
    if (
      /UPDATE\s+["']?checkpoints["']?/i.test(sql) &&
      /SET\s+["']?template_checkpoint_id["']?/i.test(sql)
    ) {
      return resolve(migrationsDir, file);
    }
  }
  return null;
}

describe('checkpoints template_checkpoint_id backfill migration', () => {
  it('backfills template_checkpoint_id via assignments.templateId + order matching', () => {
    const path = findBackfillMigration();
    expect(path).not.toBeNull();

    const sql = readFileSync(path!, 'utf8');
    const lower = sql.toLowerCase();

    // UPDATE checkpoints SET template_checkpoint_id = ...
    expect(lower).toMatch(/update\s+["']?checkpoints["']?/);
    expect(lower).toMatch(/set\s+["']?template_checkpoint_id["']?/);

    // Join through assignments (checkpoints.assignment_id → assignments.id)
    expect(lower).toContain('assignments');
    expect(lower).toMatch(/["']?assignment_id["']?/);

    // Reference template_checkpoints (the FK target table)
    expect(lower).toContain('template_checkpoints');

    // Match on template_id (assignments.templateId → template_checkpoints.templateId)
    expect(lower).toMatch(/["']?template_id["']?/);

    // Match on order (checkpoints.order = template_checkpoints.order)
    expect(lower).toMatch(/["']?order["']?/);
  });

  it('has a companion rollback migration that nulls template_checkpoint_id', () => {
    const path = findBackfillMigration();
    expect(path).not.toBeNull();

    const migrationBase = basename(path!).replace(/\.sql$/, '');
    const rollbackPath = resolve(rollbackDir, `${migrationBase}.rollback.sql`);
    expect(existsSync(rollbackPath)).toBe(true);

    const sql = readFileSync(rollbackPath, 'utf8');
    expect(sql).toMatch(/UPDATE\s+["']?checkpoints["']?/i);
    expect(sql).toMatch(/["']?template_checkpoint_id["']?\s*=\s*NULL/i);
  });
});
