import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { getTableConfig } from 'drizzle-orm/pg-core';

const migrationsDir = resolve(process.cwd(), 'drizzle/migrations');
const rollbackDir = resolve(migrationsDir, 'rollback');

function findReportJobsMigration(): string | null {
  for (const file of readdirSync(migrationsDir).filter((name) => name.endsWith('.sql'))) {
    const path = resolve(migrationsDir, file);
    if (/CREATE TABLE\s+"report_jobs"/i.test(readFileSync(path, 'utf8'))) return path;
  }
  return null;
}

describe('report jobs schema', () => {
  it('defines bounded report types, locales, and lifecycle states', async () => {
    const { reportJobState, reportLocale, reportType } = await import('@/db/schema/report-jobs');

    expect(reportType.enumValues).toEqual([
      'institutional_academic_summary',
      'official_transcript',
      'analytics_summary',
    ]);
    expect(reportLocale.enumValues).toEqual(['en', 'id']);
    expect(reportJobState.enumValues).toEqual([
      'pending',
      'processing',
      'completed',
      'failed',
      'expired',
    ]);
  });

  it('stores requester, normalized parameters, artifact, failure, and lifecycle metadata', async () => {
    const { reportJobs } = await import('@/db/schema/report-jobs');

    for (const column of [
      'id',
      'reportType',
      'requesterId',
      'parameters',
      'locale',
      'state',
      'attempts',
      'artifactKey',
      'artifactSizeBytes',
      'artifactSha256',
      'failureCode',
      'failureMessage',
      'createdAt',
      'updatedAt',
      'startedAt',
      'completedAt',
      'failedAt',
      'expiresAt',
    ]) {
      expect(reportJobs).toHaveProperty(column);
    }

    for (const column of [
      'reportType',
      'requesterId',
      'parameters',
      'locale',
      'state',
      'attempts',
    ]) {
      expect((reportJobs as any)[column].notNull).toBe(true);
    }
    expect(reportJobs.state.hasDefault).toBe(true);
    expect(reportJobs.attempts.hasDefault).toBe(true);
  });

  it('enforces lifecycle consistency and provides queue, ownership, and cleanup indexes', async () => {
    const { reportJobs } = await import('@/db/schema/report-jobs');
    const config = getTableConfig(reportJobs);

    expect(config.checks.map((check) => check.name)).toEqual(
      expect.arrayContaining([
        'report_jobs_attempts_nonnegative',
        'report_jobs_state_metadata_consistency',
      ]),
    );
    expect(config.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        'report_jobs_state_created_at_idx',
        'report_jobs_requester_created_at_idx',
        'report_jobs_expiry_idx',
      ]),
    );
    expect(config.foreignKeys.map((key) => key.reference().foreignTable)).toContainEqual(
      expect.objectContaining({ id: expect.anything() }),
    );
  });

  it('is re-exported with its requester relation', async () => {
    const schema = await import('@/db/schema/index');

    expect(schema).toHaveProperty('reportJobs');
    expect(schema).toHaveProperty('reportJobsRelations');
  });
});

describe('report jobs migration contract', () => {
  it('creates database enums, constraints, indexes, and a reversible table', () => {
    const migrationPath = findReportJobsMigration();
    expect(migrationPath).not.toBeNull();

    const migration = readFileSync(migrationPath!, 'utf8');
    expect(migration).toMatch(/CREATE TYPE\s+"public"\."report_type"/i);
    expect(migration).toMatch(/CREATE TYPE\s+"public"\."report_job_state"/i);
    expect(migration).toContain('report_jobs_state_metadata_consistency');
    expect(migration).toContain('report_jobs_expiry_idx');

    const base = basename(migrationPath!).replace(/\.sql$/, '');
    const rollbackPath = resolve(rollbackDir, `${base}.rollback.sql`);
    expect(existsSync(rollbackPath)).toBe(true);
    const rollback = readFileSync(rollbackPath, 'utf8');
    expect(rollback).toMatch(/DROP TABLE IF EXISTS "report_jobs"/i);
    expect(rollback).toMatch(/DROP TYPE IF EXISTS "report_job_state"/i);
  });
});
