import { describe, it, expect } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';

describe('Rubrics schema', () => {
  it('should export rubricCriteria, rubricLevels, and reviewScores tables', async () => {
    const mod = await import('@/db/schema/rubrics');
    expect(mod).toHaveProperty('rubricCriteria');
    expect(mod).toHaveProperty('rubricLevels');
    expect(mod).toHaveProperty('reviewScores');
  });

  it('should have correct columns on rubricCriteria', async () => {
    const { rubricCriteria } = await import('@/db/schema/rubrics');
    expect(rubricCriteria).toHaveProperty('id');
    expect(rubricCriteria).toHaveProperty('templateCheckpointId');
    expect(rubricCriteria).toHaveProperty('title');
    expect(rubricCriteria).toHaveProperty('description');
    expect(rubricCriteria).toHaveProperty('weight');
    expect(rubricCriteria).toHaveProperty('order');
    expect(rubricCriteria).toHaveProperty('deletedAt');
    expect(rubricCriteria).toHaveProperty('createdAt');
  });

  it('should enforce CHECK constraint on rubricCriteria.weight (0-100)', async () => {
    const { rubricCriteria } = await import('@/db/schema/rubrics');
    const config = getTableConfig(rubricCriteria);
    const check = config.checks.find((c) => c.name === 'rubric_criteria_weight_range');
    expect(check).toBeDefined();
  });

  it('should have correct columns on rubricLevels', async () => {
    const { rubricLevels } = await import('@/db/schema/rubrics');
    expect(rubricLevels).toHaveProperty('id');
    expect(rubricLevels).toHaveProperty('templateCheckpointId');
    expect(rubricLevels).toHaveProperty('label');
    expect(rubricLevels).toHaveProperty('description');
    expect(rubricLevels).toHaveProperty('score');
    expect(rubricLevels).toHaveProperty('order');
    expect(rubricLevels).toHaveProperty('deletedAt');
    expect(rubricLevels).toHaveProperty('createdAt');
  });

  it('should enforce CHECK constraint on rubricLevels.score (0-100)', async () => {
    const { rubricLevels } = await import('@/db/schema/rubrics');
    const config = getTableConfig(rubricLevels);
    const check = config.checks.find((c) => c.name === 'rubric_levels_score_range');
    expect(check).toBeDefined();
  });

  it('should have correct columns on reviewScores', async () => {
    const { reviewScores } = await import('@/db/schema/rubrics');
    expect(reviewScores).toHaveProperty('id');
    expect(reviewScores).toHaveProperty('reviewId');
    expect(reviewScores).toHaveProperty('criterionId');
    expect(reviewScores).toHaveProperty('criterionTitle');
    expect(reviewScores).toHaveProperty('score');
    expect(reviewScores).toHaveProperty('weight');
    expect(reviewScores).toHaveProperty('rubricLevelId');
    expect(reviewScores).toHaveProperty('levelLabel');
    expect(reviewScores).toHaveProperty('comment');
    expect(reviewScores).toHaveProperty('createdAt');
  });
});
