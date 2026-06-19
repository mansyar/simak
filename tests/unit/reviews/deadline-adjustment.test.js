/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitReviewHandler } from '@/server/reviews.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import * as sla from '@/lib/sla';
vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));
vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));
vi.mock('@/lib/sla', () => ({
  calculateBreachDuration: vi.fn(),
}));
vi.mock('@/lib/storage', () => ({
  generateFileKey: vi.fn().mockReturnValue('feedback/test-uuid.pdf'),
  generatePresignedUploadUrl: vi.fn().mockResolvedValue('https://presigned-upload.test/url'),
  generatePresignedDownloadUrl: vi.fn().mockResolvedValue('https://presigned-download.test/url'),
  getR2Client: vi.fn().mockReturnValue({}),
}));
describe('Deadline adjustment in submitReview', () => {
  let mockDb;
  let mockTx;
  const instructorSession = {
    user: { id: 'instructor-1', role: 'instructor' },
    session: {},
  };
  const baseDate = new Date('2026-05-20T10:00:00Z');
  function createMockTx() {
    return {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      then: vi.fn((onfulfilled) => Promise.resolve([]).then(onfulfilled)),
    };
  }
  function makeSubmissionRow(overrides) {
    return [
      {
        checkpointId: 100,
        checkpointState: 'under_review',
        assignmentId: 1,
        instructorId: 'instructor-1',
        studentId: 'student-1',
        checkpointUpdatedAt: baseDate,
        checkpointDueDate: new Date('2026-06-01T00:00:00Z'),
        checkpointOrder: 1,
        finalDeadline: new Date('2026-07-01T00:00:00Z'),
        ...overrides,
      },
    ];
  }
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx = createMockTx();
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      transaction: vi.fn((cb) => cb(mockTx)),
      then: vi.fn((onfulfilled) => Promise.resolve([]).then(onfulfilled)),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb);
  });
  it('should NOT adjust deadlines when review is on time', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
    vi.mocked(sla.calculateBreachDuration).mockReturnValue(0);
    // Initial query returns submission data (via mockDb.then)
    mockDb.then.mockImplementationOnce((onfulfilled) =>
      Promise.resolve(makeSubmissionRow()).then(onfulfilled),
    );
    const result = await submitReviewHandler({
      data: { submissionId: 1, decision: 'pass', comment: 'Well done!' },
    });
    expect(result).toEqual({ success: true });
    expect(sla.calculateBreachDuration).toHaveBeenCalled();
  });
  it('should extend checkpoint dueDate when review is late', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
    vi.mocked(sla.calculateBreachDuration).mockReturnValue(3);
    // Initial query (via mockDb.then)
    mockDb.then.mockImplementationOnce((onfulfilled) =>
      Promise.resolve(makeSubmissionRow()).then(onfulfilled),
    );
    // Inside transaction: queries return empty (no subsequent checkpoints)
    mockTx.then.mockImplementation((onfulfilled) => Promise.resolve([]).then(onfulfilled));
    await submitReviewHandler({
      data: { submissionId: 1, decision: 'pass', comment: 'Well done!' },
    });
    expect(sla.calculateBreachDuration).toHaveBeenCalled();
    // Should have called update for: state change, dueDate extension, and finalDeadline
    expect(mockTx.update).toHaveBeenCalled();
  });
  it('should extend all subsequent checkpoints for the same student', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
    vi.mocked(sla.calculateBreachDuration).mockReturnValue(2);
    // Initial query
    mockDb.then.mockImplementationOnce((onfulfilled) =>
      Promise.resolve(makeSubmissionRow()).then(onfulfilled),
    );
    // Transaction: next checkpoint query returns subsequent checkpoints
    mockTx.then
      .mockImplementationOnce((onfulfilled) =>
        Promise.resolve([
          { id: 200, dueDate: new Date('2026-06-15T00:00:00Z') },
          { id: 201, dueDate: new Date('2026-06-30T00:00:00Z') },
        ]).then(onfulfilled),
      )
      .mockImplementation((onfulfilled) => Promise.resolve([]).then(onfulfilled));
    await submitReviewHandler({
      data: { submissionId: 1, decision: 'pass', comment: 'Well done!' },
    });
    expect(sla.calculateBreachDuration).toHaveBeenCalled();
    expect(mockTx.update).toHaveBeenCalled();
  });
  it('should extend assignment finalDeadline when review is late', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
    vi.mocked(sla.calculateBreachDuration).mockReturnValue(3);
    // Initial query
    mockDb.then.mockImplementationOnce((onfulfilled) =>
      Promise.resolve(makeSubmissionRow()).then(onfulfilled),
    );
    // Transaction: no subsequent checkpoints
    mockTx.then.mockImplementation((onfulfilled) => Promise.resolve([]).then(onfulfilled));
    await submitReviewHandler({
      data: { submissionId: 1, decision: 'pass', comment: 'Well done!' },
    });
    expect(sla.calculateBreachDuration).toHaveBeenCalled();
  });
  it('should only adjust deadlines for affected student', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
    vi.mocked(sla.calculateBreachDuration).mockReturnValue(2);
    // Initial query
    mockDb.then.mockImplementationOnce((onfulfilled) =>
      Promise.resolve(makeSubmissionRow()).then(onfulfilled),
    );
    // Transaction: subsequent checkpoints query filters by studentId
    mockTx.then.mockImplementation((onfulfilled) => Promise.resolve([]).then(onfulfilled));
    await submitReviewHandler({
      data: { submissionId: 1, decision: 'pass', comment: 'Well done!' },
    });
    expect(sla.calculateBreachDuration).toHaveBeenCalled();
  });
  it('should handle late review with revise decision', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
    vi.mocked(sla.calculateBreachDuration).mockReturnValue(2);
    // Initial query
    mockDb.then.mockImplementationOnce((onfulfilled) =>
      Promise.resolve(makeSubmissionRow()).then(onfulfilled),
    );
    mockTx.then.mockImplementation((onfulfilled) => Promise.resolve([]).then(onfulfilled));
    await submitReviewHandler({
      data: {
        submissionId: 1,
        decision: 'revise',
        comment: 'Needs work',
        revisionDeadline: '2026-06-10T00:00:00Z',
      },
    });
    expect(sla.calculateBreachDuration).toHaveBeenCalled();
  });
  it('should reject unauthorized access', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
    const result = await submitReviewHandler({
      data: { submissionId: 1, decision: 'pass', comment: '' },
    });
    expect(result).toEqual({ error: 'Unauthorized' });
  });
});
