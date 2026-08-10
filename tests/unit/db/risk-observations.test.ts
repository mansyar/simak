import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { getTableConfig } from 'drizzle-orm/pg-core';

const migrationsDir = resolve(process.cwd(), 'drizzle/migrations');
const rollbackDir = resolve(migrationsDir, 'rollback');

function findRiskObservationsMigration(): string | null {
  for (const file of readdirSync(migrationsDir).filter((name) => name.endsWith('.sql'))) {
    const path = resolve(migrationsDir, file);
    if (/CREATE TABLE\s+"risk_observations"/i.test(readFileSync(path, 'utf8'))) return path;
  }
  return null;
}

describe('risk observations schema', () => {
  it('defines bounded source, lifecycle, retention, and risk-level values', async () => {
    const {
      riskLevel,
      riskLifecycleEventType,
      riskObservationRetentionState,
      riskObservationSource,
    } = await import('@/db/schema/risk-observations');

    expect(riskObservationSource.enumValues).toEqual(['lifecycle_event', 'daily_snapshot']);
    expect(riskLifecycleEventType.enumValues).toEqual([
      'checkpoint_updated',
      'submission_recorded',
      'review_recorded',
      'consultation_verified',
      'intervention_updated',
    ]);
    expect(riskObservationRetentionState.enumValues).toEqual(['identifiable', 'anonymized']);
    expect(riskLevel.enumValues).toEqual(['low', 'medium', 'high']);
  });

  it('stores immutable observation, academic context, and anonymization metadata', async () => {
    const { riskObservations } = await import('@/db/schema/risk-observations');

    for (const column of [
      'id',
      'source',
      'eventType',
      'sourceEventId',
      'idempotencyKey',
      'assignmentId',
      'studentId',
      'checkpointId',
      'interventionId',
      'academicTermId',
      'courseId',
      'sectionId',
      'observedAt',
      'algorithmVersion',
      'riskLevel',
      'factorSnapshot',
      'explanationSnapshot',
      'retentionState',
      'anonymizedAt',
      'createdAt',
    ]) {
      expect(riskObservations).toHaveProperty(column);
    }

    for (const column of [
      'source',
      'idempotencyKey',
      'academicTermId',
      'courseId',
      'sectionId',
      'observedAt',
      'algorithmVersion',
      'riskLevel',
      'factorSnapshot',
      'explanationSnapshot',
      'retentionState',
      'createdAt',
    ]) {
      expect((riskObservations as any)[column].notNull).toBe(true);
    }
  });

  it('enforces source, retention, and append-only database invariants', async () => {
    const { riskObservations } = await import('@/db/schema/risk-observations');
    const config = getTableConfig(riskObservations);

    expect(config.checks.map((check) => check.name)).toEqual(
      expect.arrayContaining([
        'risk_observations_source_event_consistency',
        'risk_observations_retention_anonymization_consistency',
      ]),
    );
    expect(config.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        'risk_observations_student_assignment_observed_at_idx',
        'risk_observations_section_observed_at_idx',
        'risk_observations_retention_idx',
      ]),
    );
    expect(config.uniqueConstraints.map((constraint) => constraint.name)).toContain(
      'risk_observations_idempotency_key_unique',
    );
    expect(config.foreignKeys).toHaveLength(7);
  });

  it('is re-exported with outward relations only', async () => {
    const schema = await import('@/db/schema/index');

    expect(schema).toHaveProperty('riskObservations');
    expect(schema).toHaveProperty('riskObservationsRelations');
  });
});

describe('risk observations migration contract', () => {
  it('creates reversible enums, table, constraints, and indexes', () => {
    const migrationPath = findRiskObservationsMigration();
    expect(migrationPath).not.toBeNull();

    const migration = readFileSync(migrationPath!, 'utf8');
    expect(migration).toMatch(/CREATE TYPE\s+"public"\."risk_observation_source"/i);
    expect(migration).toMatch(/CREATE TYPE\s+"public"\."risk_observation_retention_state"/i);
    expect(migration).toContain('risk_observations_source_event_consistency');
    expect(migration).toContain('risk_observations_retention_anonymization_consistency');
    expect(migration).toContain('risk_observations_idempotency_key_unique');

    const base = basename(migrationPath!).replace(/\.sql$/, '');
    const rollbackPath = resolve(rollbackDir, `${base}.rollback.sql`);
    expect(existsSync(rollbackPath)).toBe(true);
    const rollback = readFileSync(rollbackPath, 'utf8');
    expect(rollback).toMatch(/DROP TABLE IF EXISTS "risk_observations"/i);
    expect(rollback).toMatch(/DROP TYPE IF EXISTS "risk_observation_source"/i);
  });
});
