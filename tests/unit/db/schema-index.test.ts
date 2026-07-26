/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import * as schema from '@/db/schema';

describe('Schema barrel exports', () => {
  it('should export rubricCriteria table', () => {
    expect(schema.rubricCriteria).toBeDefined();
  });

  it('should export rubricLevels table', () => {
    expect(schema.rubricLevels).toBeDefined();
  });

  it('should export reviewScores table', () => {
    expect(schema.reviewScores).toBeDefined();
  });

  it('should export rubricCriteriaRelations', () => {
    expect(schema.rubricCriteriaRelations).toBeDefined();
  });

  it('should export rubricLevelsRelations', () => {
    expect(schema.rubricLevelsRelations).toBeDefined();
  });

  it('should export reviewScoresRelations', () => {
    expect(schema.reviewScoresRelations).toBeDefined();
  });

  it('should export assignmentGradeConfig table', () => {
    expect(schema.assignmentGradeConfig).toBeDefined();
  });

  it('should export finalGrades table', () => {
    expect(schema.finalGrades).toBeDefined();
  });

  it('should export assignmentGradeConfigRelations', () => {
    expect(schema.assignmentGradeConfigRelations).toBeDefined();
  });

  it('should export finalGradesRelations', () => {
    expect(schema.finalGradesRelations).toBeDefined();
  });
});
