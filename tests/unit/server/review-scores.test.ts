/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/rubrics.server', () => ({
  fetchRubric: vi.fn(),
}));

import { validateReviewScores, insertReviewScores } from '@/server/review-scores.server';
import { fetchRubric } from '@/server/rubrics.server';
import { reviewScores } from '@/db/schema/rubrics';

describe('validateReviewScores', () => {
  let mockTx: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTx = {};
  });

  it('should return null when no templateCheckpointId and no scores', async () => {
    const result = await validateReviewScores(mockTx, null, undefined);
    expect(result).toBeNull();
    expect(fetchRubric).not.toHaveBeenCalled();
  });

  it('should return error when scores provided but no templateCheckpointId', async () => {
    const result = await validateReviewScores(mockTx, null, [{ criterionId: 1, score: 80 }]);
    expect(result).toEqual({
      error: { code: 'BAD_REQUEST', message: 'Scores provided but checkpoint has no rubric' },
    });
  });

  it('should return null when rubric is null (grading_type null) and no scores', async () => {
    vi.mocked(fetchRubric).mockResolvedValue(null);
    const result = await validateReviewScores(mockTx, 42, undefined);
    expect(result).toBeNull();
  });

  it('should return error when scores provided but grading_type is null', async () => {
    vi.mocked(fetchRubric).mockResolvedValue(null);
    const result = await validateReviewScores(mockTx, 42, [{ criterionId: 1, score: 80 }]);
    expect(result).toEqual({
      error: { code: 'BAD_REQUEST', message: 'Scores provided but checkpoint has no rubric' },
    });
  });

  it('should return error when rubric exists but no scores provided', async () => {
    vi.mocked(fetchRubric).mockResolvedValue({
      gradingType: 'numeric',
      criteria: [{ id: 1, title: 'Quality', description: null, weight: 100, order: 0 }],
      levels: [],
    });
    const result = await validateReviewScores(mockTx, 42, undefined);
    expect(result).toEqual({
      error: { code: 'BAD_REQUEST', message: 'Scores required for rubric-based checkpoint' },
    });
  });

  it('should return error when not all criteria are scored', async () => {
    vi.mocked(fetchRubric).mockResolvedValue({
      gradingType: 'numeric',
      criteria: [
        { id: 1, title: 'Quality', description: null, weight: 60, order: 0 },
        { id: 2, title: 'Clarity', description: null, weight: 40, order: 1 },
      ],
      levels: [],
    });
    const result = await validateReviewScores(mockTx, 42, [{ criterionId: 1, score: 80 }]);
    expect(result).toEqual({
      error: { code: 'BAD_REQUEST', message: 'Criterion "Clarity" not scored' },
    });
  });

  it('should return error on duplicate criterion scores', async () => {
    vi.mocked(fetchRubric).mockResolvedValue({
      gradingType: 'numeric',
      criteria: [{ id: 1, title: 'Quality', description: null, weight: 100, order: 0 }],
      levels: [],
    });
    const result = await validateReviewScores(mockTx, 42, [
      { criterionId: 1, score: 80 },
      { criterionId: 1, score: 90 },
    ]);
    expect(result).toEqual({
      error: { code: 'BAD_REQUEST', message: 'Duplicate criterion scores provided' },
    });
  });

  it('should return error when rubricLevelId does not belong to rubric', async () => {
    vi.mocked(fetchRubric).mockResolvedValue({
      gradingType: 'qualitative',
      criteria: [{ id: 1, title: 'Quality', description: null, weight: 100, order: 0 }],
      levels: [{ id: 10, label: 'Excellent', description: null, score: 90, order: 0 }],
    });
    const result = await validateReviewScores(mockTx, 42, [
      { criterionId: 1, score: 90, rubricLevelId: 999 },
    ]);
    expect(result).toEqual({
      error: { code: 'BAD_REQUEST', message: 'Invalid rubric level for this checkpoint' },
    });
  });

  it('should return null when all criteria are scored (valid)', async () => {
    vi.mocked(fetchRubric).mockResolvedValue({
      gradingType: 'numeric',
      criteria: [{ id: 1, title: 'Quality', description: null, weight: 100, order: 0 }],
      levels: [],
    });
    const result = await validateReviewScores(mockTx, 42, [{ criterionId: 1, score: 85 }]);
    expect(result).toBeNull();
  });
});

describe('insertReviewScores', () => {
  let mockTx: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTx = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      then: vi.fn((onfulfilled: any) => Promise.resolve([]).then(onfulfilled)),
    };
  });

  it('should insert scores with denormalized snapshot for numeric rubric', async () => {
    vi.mocked(fetchRubric).mockResolvedValue({
      gradingType: 'numeric',
      criteria: [{ id: 1, title: 'Quality', description: null, weight: 100, order: 0 }],
      levels: [],
    });
    await insertReviewScores(mockTx, 42, 1, [{ criterionId: 1, score: 85, comment: 'Good work' }]);
    expect(mockTx.insert).toHaveBeenCalledWith(reviewScores);
    expect(mockTx.values).toHaveBeenCalledWith([
      {
        reviewId: 42,
        criterionId: 1,
        criterionTitle: 'Quality',
        score: 85,
        weight: 100,
        rubricLevelId: null,
        levelLabel: null,
        comment: 'Good work',
      },
    ]);
  });

  it('should insert scores with level label for qualitative rubric', async () => {
    vi.mocked(fetchRubric).mockResolvedValue({
      gradingType: 'qualitative',
      criteria: [{ id: 1, title: 'Quality', description: null, weight: 100, order: 0 }],
      levels: [
        { id: 10, label: 'Excellent', description: null, score: 90, order: 0 },
        { id: 11, label: 'Good', description: null, score: 70, order: 1 },
      ],
    });
    await insertReviewScores(mockTx, 42, 1, [{ criterionId: 1, score: 90, rubricLevelId: 10 }]);
    expect(mockTx.values).toHaveBeenCalledWith([
      {
        reviewId: 42,
        criterionId: 1,
        criterionTitle: 'Quality',
        score: 90,
        weight: 100,
        rubricLevelId: 10,
        levelLabel: 'Excellent',
        comment: null,
      },
    ]);
  });

  it('should handle multiple criteria with weights snapshot', async () => {
    vi.mocked(fetchRubric).mockResolvedValue({
      gradingType: 'numeric',
      criteria: [
        { id: 1, title: 'Content', description: null, weight: 60, order: 0 },
        { id: 2, title: 'Style', description: null, weight: 40, order: 1 },
      ],
      levels: [],
    });
    await insertReviewScores(mockTx, 42, 1, [
      { criterionId: 1, score: 80 },
      { criterionId: 2, score: 90, comment: 'Well written' },
    ]);
    const inserted = mockTx.values.mock.calls[0][0];
    expect(inserted).toHaveLength(2);
    expect(inserted[0].weight).toBe(60);
    expect(inserted[1].weight).toBe(40);
    expect(inserted[0].criterionTitle).toBe('Content');
    expect(inserted[1].criterionTitle).toBe('Style');
    expect(inserted[1].comment).toBe('Well written');
    expect(inserted[0].comment).toBeNull();
  });

  it('should filter out scores for non-existent criteria (live rubric changes)', async () => {
    vi.mocked(fetchRubric).mockResolvedValue({
      gradingType: 'numeric',
      criteria: [{ id: 1, title: 'Quality', description: null, weight: 100, order: 0 }],
      levels: [],
    });
    await insertReviewScores(mockTx, 42, 1, [
      { criterionId: 1, score: 80 },
      { criterionId: 999, score: 50 },
    ]);
    const inserted = mockTx.values.mock.calls[0][0];
    expect(inserted).toHaveLength(1);
    expect(inserted[0].criterionId).toBe(1);
  });

  it('should persist null levelLabel when rubricLevelId not provided (numeric)', async () => {
    vi.mocked(fetchRubric).mockResolvedValue({
      gradingType: 'numeric',
      criteria: [{ id: 1, title: 'Quality', description: null, weight: 100, order: 0 }],
      levels: [],
    });
    await insertReviewScores(mockTx, 42, 1, [{ criterionId: 1, score: 75 }]);
    const inserted = mockTx.values.mock.calls[0][0];
    expect(inserted[0].rubricLevelId).toBeNull();
    expect(inserted[0].levelLabel).toBeNull();
    expect(inserted[0].comment).toBeNull();
  });

  it('should not insert when rubric is null', async () => {
    vi.mocked(fetchRubric).mockResolvedValue(null);
    await insertReviewScores(mockTx, 42, 1, [{ criterionId: 1, score: 80 }]);
    expect(mockTx.insert).not.toHaveBeenCalled();
  });
});
