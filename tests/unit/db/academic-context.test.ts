import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const migrationsDir = resolve(process.cwd(), 'drizzle/migrations');
const rollbackDir = resolve(migrationsDir, 'rollback');

function tableConfig(table: unknown) {
  return getTableConfig(table as any);
}

function uniqueColumns(table: unknown, name: string): string[] {
  const constraint = tableConfig(table).uniqueConstraints.find((item) => item.name === name);
  return constraint?.columns.map((column) => column.name) ?? [];
}

function foreignTableNames(table: unknown): string[] {
  return tableConfig(table).foreignKeys.map((key) => {
    const reference = key.reference();
    return (reference.foreignTable as any)[Symbol.for('drizzle:Name')];
  });
}

function findAcademicContextMigration(): string | null {
  const files = readdirSync(migrationsDir).filter((file) => file.endsWith('.sql'));

  for (const file of files) {
    const path = resolve(migrationsDir, file);
    const sql = readFileSync(path, 'utf8');
    if (/CREATE TABLE\s+"academic_terms"/i.test(sql)) {
      return path;
    }
  }

  return null;
}

describe('academic context schema', () => {
  it('exports the normalized academic context tables and relations', async () => {
    const schemaIndex = await import('@/db/schema/index');

    for (const name of ['academicTerms', 'courses', 'courseSections', 'sectionEnrollments']) {
      expect(schemaIndex).toHaveProperty(name);
    }

    for (const name of [
      'academicTermsRelations',
      'coursesRelations',
      'courseSectionsRelations',
      'sectionEnrollmentsRelations',
    ]) {
      expect(schemaIndex).toHaveProperty(name);
    }
  });

  it('defines term identity, dates, and lifecycle fields', async () => {
    const { academicTerms, academicTermStatus } = await import('@/db/schema/index');

    expect(academicTermStatus.enumValues).toEqual(['draft', 'active', 'closed', 'archived']);
    expect(academicTerms).toHaveProperty('id');
    expect(academicTerms).toHaveProperty('code');
    expect(academicTerms).toHaveProperty('name');
    expect(academicTerms).toHaveProperty('startDate');
    expect(academicTerms).toHaveProperty('endDate');
    expect(academicTerms).toHaveProperty('status');
    expect(academicTerms.code.notNull).toBe(true);
    expect(academicTerms.status.notNull).toBe(true);
    expect(academicTerms.status.hasDefault).toBe(true);
    expect(uniqueColumns(academicTerms, 'academic_terms_code_unq')).toEqual(['code']);
    expect(
      tableConfig(academicTerms).checks.some((check) => check.name === 'academic_terms_date_range'),
    ).toBe(true);
  });

  it('defines reusable courses and term-specific sections', async () => {
    const { courses, courseSections } = await import('@/db/schema/index');

    expect(courses).toHaveProperty('id');
    expect(courses).toHaveProperty('code');
    expect(courses).toHaveProperty('name');
    expect(courses.code.notNull).toBe(true);
    expect(uniqueColumns(courses, 'courses_code_unq')).toEqual(['code']);

    expect(courseSections).toHaveProperty('id');
    expect(courseSections).toHaveProperty('termId');
    expect(courseSections).toHaveProperty('courseId');
    expect(courseSections).toHaveProperty('code');
    expect(courseSections).toHaveProperty('status');
    expect(courseSections.status.notNull).toBe(true);
    expect(courseSections.status.hasDefault).toBe(true);
    expect(uniqueColumns(courseSections, 'course_sections_term_course_code_unq')).toEqual([
      'term_id',
      'course_id',
      'code',
    ]);
    expect(foreignTableNames(courseSections)).toEqual(
      expect.arrayContaining(['academic_terms', 'courses']),
    );
  });

  it('defines role-aware active section memberships with history-safe identity', async () => {
    const { sectionEnrollments, sectionEnrollmentRole } = await import('@/db/schema/index');

    expect(sectionEnrollmentRole.enumValues).toEqual(['instructor', 'student']);
    expect(sectionEnrollments).toHaveProperty('id');
    expect(sectionEnrollments).toHaveProperty('sectionId');
    expect(sectionEnrollments).toHaveProperty('userId');
    expect(sectionEnrollments).toHaveProperty('role');
    expect(sectionEnrollments).toHaveProperty('isActive');
    expect(sectionEnrollments.role.notNull).toBe(true);
    expect(sectionEnrollments.isActive.notNull).toBe(true);
    expect(sectionEnrollments.isActive.hasDefault).toBe(true);
    expect(uniqueColumns(sectionEnrollments, 'section_enrollments_section_user_unq')).toEqual([
      'section_id',
      'user_id',
    ]);
    expect(foreignTableNames(sectionEnrollments)).toEqual(
      expect.arrayContaining(['course_sections', 'users']),
    );
  });
});

describe('assignment academic context contract', () => {
  it('requires one section and keeps individual mode as the default', async () => {
    const { assignments, assignmentMode, assignmentStatus } =
      await import('@/db/schema/assignments');

    expect(assignmentMode.enumValues).toEqual(['individual', 'group']);
    expect(assignmentStatus.enumValues).toEqual(['draft', 'active', 'archived']);
    expect(assignments).toHaveProperty('sectionId');
    expect(assignments).toHaveProperty('mode');
    expect(assignments).toHaveProperty('status');
    expect(assignments.sectionId.notNull).toBe(true);
    expect(assignments.mode.notNull).toBe(true);
    expect(assignments.mode.hasDefault).toBe(true);
    expect(assignments.status.notNull).toBe(true);
    expect(assignments.status.hasDefault).toBe(true);
    expect(assignments).toHaveProperty('deletedAt');
  });
});

describe('academic context migration contract', () => {
  it('rejects unexpected existing assignment rows instead of fabricating context', () => {
    const migrationPath = findAcademicContextMigration();
    expect(migrationPath).not.toBeNull();

    const sql = readFileSync(migrationPath!, 'utf8');
    expect(sql).toMatch(/DO\s+\$\$[\s\S]*assignments[\s\S]*RAISE\s+EXCEPTION/i);
    expect(sql).toMatch(/EXISTS\s*\(\s*SELECT\s+1[\s\S]*assignments/i);
    expect(sql).toMatch(/prelaunch|legacy|academic context/i);
    expect(sql).not.toMatch(/UPDATE\s+"?assignments"?\s+SET/i);
  });

  it('has a companion rollback that removes context objects and assignment columns', () => {
    const migrationPath = findAcademicContextMigration();
    expect(migrationPath).not.toBeNull();

    const migrationBase = basename(migrationPath!).replace(/\.sql$/, '');
    const rollbackPath = resolve(rollbackDir, `${migrationBase}.rollback.sql`);
    expect(existsSync(rollbackPath)).toBe(true);

    const sql = readFileSync(rollbackPath, 'utf8');
    expect(sql).toMatch(/DROP TABLE IF EXISTS "section_enrollments"/i);
    expect(sql).toMatch(/DROP TABLE IF EXISTS "course_sections"/i);
    expect(sql).toMatch(/DROP TABLE IF EXISTS "courses"/i);
    expect(sql).toMatch(/DROP TABLE IF EXISTS "academic_terms"/i);
    expect(sql).toMatch(/DROP COLUMN IF EXISTS "section_id"/i);
    expect(sql).toMatch(/DROP COLUMN IF EXISTS "mode"/i);
    expect(sql).toMatch(/DROP COLUMN IF EXISTS "status"/i);
  });
});

describe('academic context fixtures', () => {
  it('resets context tables before recreating test fixtures', async () => {
    const { TABLES_TO_TRUNCATE } = await import('../../e2e/helpers/db-reset');
    const contextTables = ['section_enrollments', 'course_sections', 'courses', 'academic_terms'];

    for (const table of contextTables) {
      expect(TABLES_TO_TRUNCATE).toContain(table);
    }
  });

  it('seeds academic context before creating the E2E assignment', () => {
    const seedSource = readFileSync(resolve(process.cwd(), 'scripts/seed-e2e.ts'), 'utf8');

    expect(seedSource).toContain('academicTerms');
    expect(seedSource).toContain('courses');
    expect(seedSource).toContain('courseSections');
    expect(seedSource).toContain('sectionEnrollments');
    expect(seedSource).toMatch(/sectionId/);
  });
});
