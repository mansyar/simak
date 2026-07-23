/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitReviewHandler } from '@/server/reviews.server';
import { checkpoints } from '@/db/schema/assignments';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import { enqueueEmail, resolveEmailRecipient } from '@/lib/email';
import { buildReviewCompletedHtml, buildRevisionRequestedHtml } from '@/lib/email-templates';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/review-sla', () => ({
  adjustDeadlinesForBreach: vi.fn(),
  dispatchSLABreachNotifications: vi.fn(),
}));

vi.mock('@/lib/storage', () => ({
  generateFileKey: vi.fn(),
  generatePresignedUploadUrl: vi.fn(),
  generatePresignedDownloadUrl: vi.fn(),
  getR2Client: vi.fn(),
  getObjectContentLength: vi.fn().mockResolvedValue({ ok: true, size: 1024 }),
  r2SizeError: vi.fn(),
}));

vi.mock('@/lib/email', () => ({
  enqueueEmail: vi.fn().mockResolvedValue(undefined),
  resolveEmailRecipient: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/email-templates', () => ({
  buildReviewCompletedHtml: vi.fn().mockReturnValue('<html>review completed body</html>'),
  buildRevisionRequestedHtml: vi.fn().mockReturnValue('<html>revision requested body</html>'),
}));

describe('Review email enqueue', () => {
  let mockDb: any;
  let mockTx: any;

  const instructorSession = {
    user: { id: 'instructor-1', name: 'Prof. Smith', role: 'instructor' as const },
    session: {} as any,
  };

  const submissionRow = {
    checkpointId: 100,
    checkpointState: 'under_review',
    checkpointName: 'Chapter 1',
    assignmentId: 1,
    assignmentTitle: 'Thesis 2026',
    instructorId: 'instructor-1',
    studentId: 'student-1',
    studentName: 'Alice',
    uploadedAt: new Date(),
    checkpointUpdatedAt: new Date(),
    checkpointDueDate: new Date(),
    checkpointOrder: 1,
    finalDeadline: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockTx = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      for: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      then: vi.fn((onfulfilled: any) => Promise.resolve([]).then(onfulfilled)),
    };

    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      distinctOn: vi.fn().mockReturnThis(),
      transaction: vi.fn((cb: (tx: any) => Promise<any>) => cb(mockTx)),
      then: vi.fn((onfulfilled: any) => Promise.resolve([]).then(onfulfilled)),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  function setupSuccessfulReview() {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    mockTx.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([submissionRow]).then(onfulfilled),
    );
  }

  it('should enqueue review_completed email to student on pass decision', async () => {
    setupSuccessfulReview();
    vi.mocked(resolveEmailRecipient).mockResolvedValue({
      email: 'student@test.com',
      locale: 'en',
    });
    vi.mocked(buildReviewCompletedHtml).mockReturnValue('<html>review body</html>');

    const result = await submitReviewHandler({
      data: { submissionId: 1, decision: 'pass', comment: 'Well done!' },
    });

    expect(result).toEqual({ success: true });

    expect(resolveEmailRecipient).toHaveBeenCalledWith('student-1');
    expect(buildReviewCompletedHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewerName: 'Prof. Smith',
        assignmentName: 'Thesis 2026',
        checkpointName: 'Chapter 1',
        assignmentId: 1,
        locale: 'en',
      }),
    );
    expect(enqueueEmail).toHaveBeenCalledWith({
      recipientEmail: 'student@test.com',
      subject: '[SIMAK] Review Completed',
      bodyHtml: '<html>review body</html>',
      templateType: 'review_completed',
    });
  });

  it('should enqueue revision_requested email to student on revise decision', async () => {
    setupSuccessfulReview();
    vi.mocked(resolveEmailRecipient).mockResolvedValue({
      email: 'student@test.com',
      locale: 'en',
    });
    vi.mocked(buildRevisionRequestedHtml).mockReturnValue('<html>revision body</html>');

    const result = await submitReviewHandler({
      data: {
        submissionId: 1,
        decision: 'revise',
        comment: 'Needs more details',
        revisionDeadline: '2026-08-01T00:00:00Z',
      },
    });

    expect(result).toEqual({ success: true });

    expect(resolveEmailRecipient).toHaveBeenCalledWith('student-1');
    expect(buildRevisionRequestedHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewerName: 'Prof. Smith',
        assignmentName: 'Thesis 2026',
        checkpointName: 'Chapter 1',
        assignmentId: 1,
        revisionDeadline: '2026-08-01T00:00:00Z',
        locale: 'en',
      }),
    );
    expect(enqueueEmail).toHaveBeenCalledWith({
      recipientEmail: 'student@test.com',
      subject: '[SIMAK] Revision Requested',
      bodyHtml: '<html>revision body</html>',
      templateType: 'revision_requested',
    });
  });

  it('should localize email subject for Indonesian student', async () => {
    setupSuccessfulReview();
    vi.mocked(resolveEmailRecipient).mockResolvedValue({
      email: 'student@test.com',
      locale: 'id',
    });

    await submitReviewHandler({
      data: { submissionId: 1, decision: 'pass', comment: 'Good' },
    });

    expect(enqueueEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: '[SIMAK] Penilaian Selesai',
      }),
    );
  });

  it('should succeed even when enqueueEmail throws (advisory-only)', async () => {
    setupSuccessfulReview();
    vi.mocked(resolveEmailRecipient).mockResolvedValue({
      email: 'student@test.com',
      locale: 'en',
    });
    vi.mocked(enqueueEmail).mockRejectedValueOnce(new Error('email service down'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await submitReviewHandler({
      data: { submissionId: 1, decision: 'pass', comment: 'Good' },
    });

    expect(result).toEqual({ success: true });
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to enqueue review_completed email:',
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });

  it('should skip email when student is soft-deleted or has no verified email', async () => {
    setupSuccessfulReview();
    vi.mocked(resolveEmailRecipient).mockResolvedValue(null);

    const result = await submitReviewHandler({
      data: { submissionId: 1, decision: 'pass', comment: 'Good' },
    });

    expect(result).toEqual({ success: true });
    expect(enqueueEmail).not.toHaveBeenCalled();
  });
});
