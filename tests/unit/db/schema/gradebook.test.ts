import { describe, it, expect } from 'vitest';

describe('Gradebook schema', () => {
  it('should export assignmentGradeConfig table', async () => {
    const mod = await import('@/db/schema/gradebook');
    expect(mod).toHaveProperty('assignmentGradeConfig');
  });

  it('should export finalGrades table', async () => {
    const mod = await import('@/db/schema/gradebook');
    expect(mod).toHaveProperty('finalGrades');
  });

  it('should export gradingScheme enum', async () => {
    const mod = await import('@/db/schema/gradebook');
    expect(mod).toHaveProperty('gradingScheme');
  });

  it('should export finalGradeStatus enum', async () => {
    const mod = await import('@/db/schema/gradebook');
    expect(mod).toHaveProperty('finalGradeStatus');
  });

  it('should have correct columns on assignmentGradeConfig', async () => {
    const { assignmentGradeConfig } = await import('@/db/schema/gradebook');
    expect(assignmentGradeConfig).toHaveProperty('assignmentId');
    expect(assignmentGradeConfig).toHaveProperty('gradingScheme');
    expect(assignmentGradeConfig).toHaveProperty('customWeights');
    expect(assignmentGradeConfig).toHaveProperty('letterGradeBounds');
    expect(assignmentGradeConfig).toHaveProperty('createdAt');
    expect(assignmentGradeConfig).toHaveProperty('updatedAt');
  });

  it('should have correct columns on finalGrades', async () => {
    const { finalGrades } = await import('@/db/schema/gradebook');
    expect(finalGrades).toHaveProperty('id');
    expect(finalGrades).toHaveProperty('assignmentId');
    expect(finalGrades).toHaveProperty('studentId');
    expect(finalGrades).toHaveProperty('numericScore');
    expect(finalGrades).toHaveProperty('letterGrade');
    expect(finalGrades).toHaveProperty('status');
    expect(finalGrades).toHaveProperty('contributingCheckpoints');
    expect(finalGrades).toHaveProperty('computedAt');
    expect(finalGrades).toHaveProperty('updatedAt');
  });

  it('should have gradingScheme enum with correct values', async () => {
    const { gradingScheme } = await import('@/db/schema/gradebook');
    const enumValues = (gradingScheme as any).enumValues as string[];
    expect(enumValues).toEqual(['equal_weight', 'custom_weight']);
  });

  it('should have finalGradeStatus enum with correct values', async () => {
    const { finalGradeStatus } = await import('@/db/schema/gradebook');
    const enumValues = (finalGradeStatus as any).enumValues as string[];
    expect(enumValues).toEqual(['complete', 'incomplete', 'in_progress']);
  });
});
