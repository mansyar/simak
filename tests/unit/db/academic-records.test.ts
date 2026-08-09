import { getTableConfig } from 'drizzle-orm/pg-core';
import { basename, resolve } from 'node:path';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationsDir = resolve(process.cwd(), 'drizzle/migrations');
const rollbackDir = resolve(migrationsDir, 'rollback');

function tableConfig(table: unknown) {
  return getTableConfig(table as any);
}

function uniqueColumns(table: unknown, name: string): string[] {
  const constraint = tableConfig(table).uniqueConstraints.find((item) => item.name === name);
  return constraint?.columns.map((column) => column.name) ?? [];
}

function indexByName(table: unknown, name: string) {
  return tableConfig(table).indexes.find((index) => index.config.name === name);
}

function foreignTableNames(table: unknown): string[] {
  return tableConfig(table).foreignKeys.map((key) => {
    const reference = key.reference();
    return (reference.foreignTable as any)[Symbol.for('drizzle:Name')];
  });
}

function findAcademicRecordsMigration(): string | null {
  const files = readdirSync(migrationsDir).filter((file) => file.endsWith('.sql'));

  for (const file of files) {
    const path = resolve(migrationsDir, file);
    const sql = readFileSync(path, 'utf8');
    if (/CREATE TABLE\s+"academic_record_policies"/i.test(sql)) {
      return path;
    }
  }

  return null;
}

describe('academic records schema', () => {
  it('exports policy, record, and relation definitions', async () => {
    const mod = await import('@/db/schema/index');

    for (const name of [
      'academicRecordStatus',
      'academicRecordPolicies',
      'academicRecords',
      'academicRecordPoliciesRelations',
      'academicRecordsRelations',
    ]) {
      expect(mod).toHaveProperty(name);
    }
  });

  it('stores positive reusable-course credits', async () => {
    const { courses } = await import('@/db/schema/academic-context');

    expect(courses).toHaveProperty('credits');
    expect(courses.credits.notNull).toBe(true);
    expect(
      tableConfig(courses).checks.some((check) => check.name === 'courses_credits_positive'),
    ).toBe(true);
  });

  it('defines append-only term-effective grading policies', async () => {
    const { academicRecordPolicies } = await import('@/db/schema/academic-records');

    expect(academicRecordPolicies).toHaveProperty('version');
    expect(academicRecordPolicies).toHaveProperty('effectiveTermId');
    expect(academicRecordPolicies).toHaveProperty('gradePoints');
    expect(academicRecordPolicies).toHaveProperty('roundingScale');
    expect(academicRecordPolicies).toHaveProperty('isActive');
    expect(academicRecordPolicies.version.notNull).toBe(true);
    expect(academicRecordPolicies.effectiveTermId.notNull).toBe(true);
    expect(academicRecordPolicies.gradePoints.notNull).toBe(true);
    expect(academicRecordPolicies.roundingScale.notNull).toBe(true);
    expect(academicRecordPolicies.roundingScale.hasDefault).toBe(true);
    expect(academicRecordPolicies.isActive.notNull).toBe(true);
    expect(uniqueColumns(academicRecordPolicies, 'academic_record_policies_version_unq')).toEqual([
      'version',
    ]);
    expect(
      indexByName(academicRecordPolicies, 'academic_record_policies_effective_term_idx'),
    ).toBeDefined();
    expect(foreignTableNames(academicRecordPolicies)).toContain('academic_terms');
  });

  it('allows at most one explicitly designated transcript source per section', async () => {
    const { assignments } = await import('@/db/schema/assignments');

    expect(assignments).toHaveProperty('isTranscriptSource');
    expect(assignments.isTranscriptSource.notNull).toBe(true);
    expect(assignments.isTranscriptSource.hasDefault).toBe(true);

    const sourceIndex = indexByName(assignments, 'assignments_section_transcript_source_idx');
    expect((sourceIndex?.config as any).unique).toBe(true);
    expect(sourceIndex?.config.columns.map((column: any) => column.name)).toEqual(['section_id']);
    expect((sourceIndex?.config as any).where).toBeDefined();
  });

  it('stores immutable release-derived record values and source references', async () => {
    const { academicRecordStatus, academicRecords } = await import('@/db/schema/academic-records');

    expect(academicRecordStatus.enumValues).toEqual(['complete', 'incomplete', 'withdrawn']);
    for (const name of [
      'id',
      'studentId',
      'courseId',
      'courseSectionId',
      'termId',
      'sourceAssignmentId',
      'sourceSnapshotId',
      'sourceReleaseVersion',
      'policyVersion',
      'recordVersion',
      'numericScore',
      'letterGrade',
      'status',
      'credits',
      'gradePoints',
      'publishedAt',
      'createdAt',
    ]) {
      expect(academicRecords).toHaveProperty(name);
    }

    expect(academicRecords.recordVersion.notNull).toBe(true);
    expect(academicRecords.policyVersion.notNull).toBe(true);
    expect(academicRecords.sourceAssignmentId.notNull).toBe(true);
    expect(academicRecords.status.notNull).toBe(true);
    expect(academicRecords.credits.notNull).toBe(true);
    expect(academicRecords).not.toHaveProperty('updatedAt');
    expect(uniqueColumns(academicRecords, 'academic_records_student_section_version_unq')).toEqual([
      'student_id',
      'course_section_id',
      'record_version',
    ]);
  });

  it('defines record lookup indexes and history-safe foreign keys', async () => {
    const { academicRecords } = await import('@/db/schema/academic-records');
    const config = tableConfig(academicRecords);

    expect(
      indexByName(academicRecords, 'academic_records_student_term_idx')?.config.columns.map(
        (column: any) => column.name,
      ),
    ).toEqual(['student_id', 'term_id']);
    expect(
      indexByName(academicRecords, 'academic_records_section_student_idx')?.config.columns.map(
        (column: any) => column.name,
      ),
    ).toEqual(['course_section_id', 'student_id']);
    expect(
      indexByName(academicRecords, 'academic_records_source_idx')?.config.columns.map(
        (column: any) => column.name,
      ),
    ).toEqual(['source_assignment_id', 'source_release_version']);
    expect(indexByName(academicRecords, 'academic_records_policy_version_idx')).toBeDefined();
    expect(foreignTableNames(academicRecords)).toEqual(
      expect.arrayContaining([
        'users',
        'courses',
        'course_sections',
        'academic_terms',
        'assignments',
        'grade_release_snapshots',
        'academic_record_policies',
      ]),
    );
    expect(config.foreignKeys.length).toBeGreaterThanOrEqual(7);
  });
});

describe('academic records migration contract', () => {
  it('creates credits, transcript source designation, policies, records, and constraints', () => {
    const migrationPath = findAcademicRecordsMigration();
    expect(migrationPath).not.toBeNull();

    const sql = readFileSync(migrationPath!, 'utf8');
    expect(sql).toMatch(/CREATE TYPE\s+"public"\."academic_record_status"/i);
    expect(sql).toMatch(/TRACK-060 prelaunch migration requires an empty courses table/i);
    expect(sql).toMatch(/ALTER TABLE\s+"courses"\s+ADD COLUMN\s+"credits"/i);
    expect(sql).toMatch(/ALTER TABLE\s+"assignments"\s+ADD COLUMN\s+"is_transcript_source"/i);
    expect(sql).toMatch(/CREATE TABLE\s+"academic_record_policies"/i);
    expect(sql).toMatch(/CREATE TABLE\s+"academic_records"/i);
    expect(sql).toContain('academic_records_student_section_version_unq');
    expect(sql).toContain('assignments_section_transcript_source_idx');
  });

  it('has a companion rollback for every schema object introduced by the track', () => {
    const migrationPath = findAcademicRecordsMigration();
    expect(migrationPath).not.toBeNull();

    const migrationBase = basename(migrationPath!).replace(/\.sql$/, '');
    const rollbackPath = resolve(rollbackDir, `${migrationBase}.rollback.sql`);
    expect(existsSync(rollbackPath)).toBe(true);

    const sql = readFileSync(rollbackPath, 'utf8');
    expect(sql).toMatch(/DROP TABLE IF EXISTS "academic_records"/i);
    expect(sql).toMatch(/DROP TABLE IF EXISTS "academic_record_policies"/i);
    expect(sql).toMatch(/DROP COLUMN IF EXISTS "is_transcript_source"/i);
    expect(sql).toMatch(/DROP COLUMN IF EXISTS "credits"/i);
    expect(sql).toMatch(/DROP TYPE IF EXISTS "academic_record_status"/i);
  });
});
