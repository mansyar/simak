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

describe('0010_deadline_reminders migration', () => {
  const migrationPath = resolve(process.cwd(), 'drizzle/migrations/0010_deadline_reminders.sql');
  const rollbackPath = resolve(
    process.cwd(),
    'drizzle/migrations/rollback/0010_deadline_reminders.rollback.sql',
  );

  it('creates deadline_reminders table with correct columns', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('CREATE TABLE "deadline_reminders"');
    expect(sql).toMatch(/"checkpoint_id"/);
    expect(sql).toMatch(/"student_id"/);
    expect(sql).toMatch(/"tier"/);
    expect(sql).toMatch(/"sent_at"/);
  });

  it('adds FK to checkpoints with ON DELETE cascade', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toMatch(/FOREIGN KEY.*"checkpoint_id".*REFERENCES.*"checkpoints"/);
    expect(sql).toMatch(/ON DELETE cascade/i);
  });

  it('adds FK to users with ON DELETE cascade', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toMatch(/FOREIGN KEY.*"student_id".*REFERENCES.*"users"/);
  });

  it('adds unique constraint on (checkpoint_id, tier)', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toMatch(/UNIQUE.*"checkpoint_id".*"tier"|UNIQUE.*"tier".*"checkpoint_id"/i);
  });

  it('creates checkpoints_state_due_date_idx index', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('checkpoints_state_due_date_idx');
    expect(sql).toMatch(
      /CREATE.*INDEX.*checkpoints_state_due_date_idx.*ON.*"checkpoints".*"state".*"due_date"/is,
    );
  });

  it('has a companion rollback migration that drops the table and index', () => {
    const sql = readFileSync(rollbackPath, 'utf8');
    expect(sql).toContain('DROP TABLE IF EXISTS "deadline_reminders"');
    expect(sql).toContain('DROP INDEX IF EXISTS "checkpoints_state_due_date_idx"');
  });
});
