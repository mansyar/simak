import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';

describe('Grade release schema', () => {
  it('exports the release status enum and snapshot table', async () => {
    const mod = await import('@/db/schema/gradebook');

    expect(mod).toHaveProperty('gradeReleaseStatus');
    expect(mod).toHaveProperty('gradeReleaseSnapshots');
  });

  it('defines draft and published release states', async () => {
    const { gradeReleaseStatus } = await import('@/db/schema/gradebook');

    expect((gradeReleaseStatus as any).enumValues).toEqual(['draft', 'published']);
  });

  it('adds release state and active release metadata to the grade config', async () => {
    const { assignmentGradeConfig } = await import('@/db/schema/gradebook');

    expect(assignmentGradeConfig).toHaveProperty('releaseStatus');
    expect(assignmentGradeConfig.releaseStatus.notNull).toBe(true);
    expect(assignmentGradeConfig.releaseStatus.hasDefault).toBe(true);
    expect(assignmentGradeConfig).toHaveProperty('activeReleaseVersion');
    expect(assignmentGradeConfig.activeReleaseVersion.notNull).toBe(false);
    expect(assignmentGradeConfig).toHaveProperty('publishedAt');
  });

  it('defines immutable published snapshot fields', async () => {
    const { gradeReleaseSnapshots } = await import('@/db/schema/gradebook');

    expect(gradeReleaseSnapshots).toHaveProperty('id');
    expect(gradeReleaseSnapshots).toHaveProperty('assignmentId');
    expect(gradeReleaseSnapshots).toHaveProperty('studentId');
    expect(gradeReleaseSnapshots).toHaveProperty('releaseVersion');
    expect(gradeReleaseSnapshots).toHaveProperty('numericScore');
    expect(gradeReleaseSnapshots).toHaveProperty('letterGrade');
    expect(gradeReleaseSnapshots).toHaveProperty('status');
    expect(gradeReleaseSnapshots).toHaveProperty('contributingCheckpoints');
    expect(gradeReleaseSnapshots).toHaveProperty('publishedAt');

    expect(gradeReleaseSnapshots.releaseVersion.notNull).toBe(true);
    expect(gradeReleaseSnapshots.numericScore.notNull).toBe(true);
    expect(gradeReleaseSnapshots.letterGrade.notNull).toBe(true);
    expect(gradeReleaseSnapshots.status.notNull).toBe(true);
    expect(gradeReleaseSnapshots.contributingCheckpoints.notNull).toBe(true);
    expect(gradeReleaseSnapshots.publishedAt.notNull).toBe(true);
  });

  it('enforces versioned student uniqueness and lookup indexes', async () => {
    const { gradeReleaseSnapshots } = await import('@/db/schema/gradebook');
    const config = getTableConfig(gradeReleaseSnapshots);
    const uniqueConstraint = config.uniqueConstraints.find(
      (constraint) => constraint.name === 'grade_release_snapshots_assignment_version_student_unq',
    );
    const assignmentVersionIndex = config.indexes.find(
      (index) => index.config.name === 'grade_release_snapshots_assignment_version_idx',
    );
    const studentIndex = config.indexes.find(
      (index) => index.config.name === 'grade_release_snapshots_student_id_idx',
    );

    expect(uniqueConstraint?.columns.map((column) => column.name)).toEqual([
      'assignment_id',
      'release_version',
      'student_id',
    ]);
    expect(assignmentVersionIndex?.config.columns.map((column) => (column as any).name)).toEqual([
      'assignment_id',
      'release_version',
    ]);
    expect(studentIndex?.config.columns.map((column) => (column as any).name)).toEqual([
      'student_id',
    ]);
  });

  it('uses assignment and student foreign keys and is re-exported with relations', async () => {
    const { gradeReleaseSnapshots } = await import('@/db/schema/gradebook');
    const config = getTableConfig(gradeReleaseSnapshots);
    const foreignTables = config.foreignKeys.map((key) => {
      const reference = key.reference();
      return {
        table: (reference.foreignTable as any)[Symbol.for('drizzle:Name')],
        column: reference.columns[0]?.name,
        foreignColumn: reference.foreignColumns[0]?.name,
      };
    });

    expect(foreignTables).toEqual(
      expect.arrayContaining([
        { table: 'assignments', column: 'assignment_id', foreignColumn: 'id' },
        { table: 'users', column: 'student_id', foreignColumn: 'id' },
      ]),
    );

    const mod = await import('@/db/schema/index');
    expect(mod).toHaveProperty('gradeReleaseSnapshots');
    expect(mod).toHaveProperty('gradeReleaseSnapshotsRelations');
  });
});
