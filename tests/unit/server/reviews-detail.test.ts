/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getReviewDetailHandler } from '@/server/reviews.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/storage', () => ({
  generatePresignedDownloadUrl: vi.fn().mockResolvedValue('https://presigned-download.test/url'),
  generatePresignedUploadUrl: vi.fn().mockResolvedValue('https://presigned-upload.test/url'),
  generateFileKey: vi.fn().mockReturnValue('feedback/test-uuid.pdf'),
  getObjectContentLength: vi.fn().mockResolvedValue({ ok: true, size: 1024 }),
  r2SizeError: vi.fn().mockReturnValue({ error: { code: 'BAD_REQUEST', message: 'File error' } }),
  getR2Client: vi.fn().mockReturnValue({}),
}));

describe('getReviewDetailHandler', () => {
  let mockDb: any;
  const instructorSession = {
    user: { id: 'instructor-1', role: 'instructor' as const },
    session: {} as any,
  };
  const studentSession = {
    user: { id: 'student-1', role: 'student' as const },
    session: {} as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      then: vi.fn((onfulfilled: any) => Promise.resolve([]).then(onfulfilled)),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  it('should reject if unauthorized', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
    const result = await getReviewDetailHandler({ data: { submissionId: 1 } });
    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  });

  it('should reject if not an instructor', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);
    const result = await getReviewDetailHandler({ data: { submissionId: 1 } });
    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  });

  it('should return NOT_FOUND if submission does not exist', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    const result = await getReviewDetailHandler({ data: { submissionId: 999 } });
    expect(result).toEqual({ error: { code: 'NOT_FOUND', message: 'Submission not found' } });
  });

  it('should return rubric criteria when checkpoint has grading_type numeric', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    mockDb.then
      // submission query
      .mockImplementationOnce((onf: any) =>
        Promise.resolve([
          {
            submissionId: 1,
            checkpointId: 100,
            templateCheckpointId: 5,
            checkpointName: 'Chapter 1',
            fileKey: 'submissions/test.pdf',
          },
        ]).then(onf),
      )
      // review history query
      .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf))
      // fetchRubric: checkpoint gradingType query
      .mockImplementationOnce((onf: any) => Promise.resolve([{ gradingType: 'numeric' }]).then(onf))
      // fetchRubric: criteria query
      .mockImplementationOnce((onf: any) =>
        Promise.resolve([
          {
            id: 1,
            title: 'Content',
            weight: 50,
            description: null,
            order: 0,
            templateCheckpointId: 5,
          },
          {
            id: 2,
            title: 'Grammar',
            weight: 50,
            description: null,
            order: 1,
            templateCheckpointId: 5,
          },
        ]).then(onf),
      );

    const result = (await getReviewDetailHandler({ data: { submissionId: 1 } })) as any;
    expect(result.submission).toBeDefined();
    expect(result.reviewHistory).toEqual([]);
    expect(result.rubric).toBeDefined();
    expect(result.rubric.gradingType).toBe('numeric');
    expect(result.rubric.criteria).toHaveLength(2);
    expect(result.rubric.levels).toEqual([]);
  });

  it('should return rubric criteria and levels when grading_type is qualitative', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    mockDb.then
      // submission query
      .mockImplementationOnce((onf: any) =>
        Promise.resolve([
          {
            submissionId: 1,
            checkpointId: 100,
            templateCheckpointId: 5,
            fileKey: 'submissions/test.pdf',
          },
        ]).then(onf),
      )
      // review history query
      .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf))
      // fetchRubric: checkpoint gradingType query
      .mockImplementationOnce((onf: any) =>
        Promise.resolve([{ gradingType: 'qualitative' }]).then(onf),
      )
      // fetchRubric: criteria query
      .mockImplementationOnce((onf: any) =>
        Promise.resolve([
          {
            id: 1,
            title: 'Content',
            weight: 100,
            description: null,
            order: 0,
            templateCheckpointId: 5,
          },
        ]).then(onf),
      )
      // fetchRubric: levels query (qualitative only)
      .mockImplementationOnce((onf: any) =>
        Promise.resolve([
          {
            id: 1,
            label: 'Excellent',
            score: 90,
            description: null,
            order: 0,
            templateCheckpointId: 5,
          },
          { id: 2, label: 'Good', score: 70, description: null, order: 1, templateCheckpointId: 5 },
        ]).then(onf),
      );

    const result = (await getReviewDetailHandler({ data: { submissionId: 1 } })) as any;
    expect(result.rubric).toBeDefined();
    expect(result.rubric.gradingType).toBe('qualitative');
    expect(result.rubric.criteria).toHaveLength(1);
    expect(result.rubric.levels).toHaveLength(2);
  });

  it('should group ordered action items under each review in history', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    mockDb.then
      // submission query
      .mockImplementationOnce((onf: any) =>
        Promise.resolve([
          {
            submissionId: 1,
            checkpointId: 100,
            templateCheckpointId: null,
            fileKey: 'submissions/test.pdf',
          },
        ]).then(onf),
      )
      // review history query
      .mockImplementationOnce((onf: any) =>
        Promise.resolve([
          {
            id: 10,
            decision: 'revise',
            comment: 'Please revise',
            instructorName: 'Instructor',
            createdAt: new Date('2026-08-01'),
          },
        ]).then(onf),
      )
      // action-item batch query
      .mockImplementationOnce((onf: any) =>
        Promise.resolve([
          {
            id: 21,
            reviewId: 10,
            itemText: 'Rewrite the conclusion',
            order: 0,
            criterionId: 5,
            criterionTitle: 'Content Quality',
            addressedAt: null,
          },
          {
            id: 22,
            reviewId: 10,
            itemText: 'Add supporting evidence',
            order: 1,
            criterionId: null,
            criterionTitle: null,
            addressedAt: new Date('2026-08-02'),
          },
        ]).then(onf),
      );

    const result = (await getReviewDetailHandler({ data: { submissionId: 1 } })) as any;

    expect(result.reviewHistory[0].actionItems).toEqual([
      expect.objectContaining({
        id: 21,
        reviewId: 10,
        order: 0,
        criterionTitle: 'Content Quality',
      }),
      expect.objectContaining({ id: 22, reviewId: 10, order: 1, criterionTitle: null }),
    ]);
  });

  it('should return null rubric when grading_type is null', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    mockDb.then
      // submission query
      .mockImplementationOnce((onf: any) =>
        Promise.resolve([
          {
            submissionId: 1,
            checkpointId: 100,
            templateCheckpointId: 5,
            fileKey: 'submissions/test.pdf',
          },
        ]).then(onf),
      )
      // review history query
      .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf))
      // fetchRubric: checkpoint gradingType query (null → returns null early)
      .mockImplementationOnce((onf: any) => Promise.resolve([{ gradingType: null }]).then(onf));

    const result = (await getReviewDetailHandler({ data: { submissionId: 1 } })) as any;
    expect(result.rubric).toBeNull();
  });

  it('should return null rubric when templateCheckpointId is null (backward compat)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    mockDb.then
      // submission query (no templateCheckpointId)
      .mockImplementationOnce((onf: any) =>
        Promise.resolve([
          {
            submissionId: 1,
            checkpointId: 100,
            templateCheckpointId: null,
            fileKey: 'submissions/test.pdf',
          },
        ]).then(onf),
      )
      // review history query
      .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf));

    const result = (await getReviewDetailHandler({ data: { submissionId: 1 } })) as any;
    expect(result.rubric).toBeNull();
  });

  it('should handle INTERNAL error on failure', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    mockDb.select.mockImplementation(() => {
      throw new Error('DB error');
    });
    const result = (await getReviewDetailHandler({ data: { submissionId: 1 } })) as any;
    expect(result.error.code).toBe('INTERNAL');
    expect(result.error.message).toBe('Internal Server Error');
  });
});
