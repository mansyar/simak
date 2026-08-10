import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { courseSections } from '@/db/schema/academic-context';
import { CreateCourseSectionSchema } from '@/server/academic-context';

const migrationsDir = join(process.cwd(), 'drizzle', 'migrations');

describe('course section cohort metadata', () => {
  it('stores optional explicit cohort metadata', () => {
    const config = getTableConfig(courseSections);
    const cohort = config.columns.find((column) => column.name === 'cohort');

    expect(cohort).toBeDefined();
    expect(cohort?.notNull).toBe(false);
  });

  it('normalizes blank cohorts to null and bounds labels', () => {
    expect(
      CreateCourseSectionSchema.parse({ termId: 1, courseId: 2, code: 'A', cohort: ' 2026 ' }),
    ).toMatchObject({ cohort: '2026' });
    expect(
      CreateCourseSectionSchema.parse({ termId: 1, courseId: 2, code: 'A', cohort: '   ' }),
    ).toMatchObject({ cohort: null });
    expect(
      CreateCourseSectionSchema.safeParse({
        termId: 1,
        courseId: 2,
        code: 'A',
        cohort: 'x'.repeat(121),
      }).success,
    ).toBe(false);
  });

  it('has a forward and rollback migration', () => {
    const migration = readdirSync(migrationsDir)
      .filter((file) => /^\d{4}_.+\.sql$/.test(file))
      .map((file) => ({ file, sql: readFileSync(join(migrationsDir, file), 'utf8') }))
      .find(({ sql }) => sql.includes('ADD COLUMN "cohort"'));

    expect(migration).toBeDefined();
    const rollback = readFileSync(
      join(migrationsDir, 'rollback', migration!.file.replace('.sql', '.rollback.sql')),
      'utf8',
    );
    expect(rollback).toContain('DROP COLUMN "cohort"');
  });
});
