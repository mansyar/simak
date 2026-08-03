/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitReviewHandler } from '@/server/reviews.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import { logAuditEvent } from '@/lib/audit';
import { dispatchSLABreachNotifications } from '@/lib/review-sla';
import { checkAndFireRiskAlert } from '@/lib/risk-alerts';
import { logger } from '@/lib/logger';
import { revisionActionItems } from '@/db/schema/revision-action-items';
import { getObjectContentLength } from '@/lib/storage';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/risk-alerts', () => ({
  checkAndFireRiskAlert: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}));

vi.mock('@/lib/storage', () => ({
  getObjectContentLength: vi.fn().mockResolvedValue({ ok: true, size: 1024 }),
  generatePresignedDownloadUrl: vi.fn(),
  r2SizeError: vi.fn(),
}));

vi.mock('@/lib/review-sla', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    dispatchSLABreachNotifications: vi.fn().mockResolvedValue(undefined),
    adjustDeadlinesForBreach: vi.fn().mockResolvedValue(undefined),
  };
});

describe('submitReviewHandler - post-commit advisory isolation', () => {
  let mockDb: any;
  let mockTx: any;
  const instructorSession = {
    user: { id: 'instructor-1', role: 'instructor' as const },
    session: {} as any,
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
      returning: vi.fn().mockReturnThis(),
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

  function setupPassSubmission(breachDays = 7) {
    // Force a breach by setting underReviewAt before SLA window.
    const reviewedAt = new Date();
    const underReviewAt = new Date(reviewedAt.getTime() - (3 + breachDays) * 24 * 60 * 60 * 1000);

    mockTx.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([
        {
          checkpointId: 100,
          checkpointState: 'under_review',
          checkpointUpdatedAt: underReviewAt,
          uploadedAt: underReviewAt,
          checkpointName: 'Chapter 1',
          checkpointDueDate: new Date('2026-06-01'),
          checkpointOrder: 1,
          assignmentId: 1,
          assignmentTitle: 'Thesis 2026',
          instructorId: 'instructor-1',
          studentId: 'student-1',
          studentName: 'Alice',
          finalDeadline: new Date('2026-08-01'),
        },
      ]).then(onfulfilled),
    );
  }

  function setupNoBreachSubmission() {
    mockTx.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([
        {
          checkpointId: 100,
          checkpointState: 'under_review',
          checkpointUpdatedAt: new Date(),
          uploadedAt: new Date(),
          checkpointName: 'Chapter 1',
          checkpointDueDate: new Date('2026-06-01'),
          checkpointOrder: 1,
          assignmentId: 1,
          assignmentTitle: 'Thesis 2026',
          instructorId: 'instructor-1',
          studentId: 'student-1',
          studentName: 'Alice',
          finalDeadline: new Date('2026-08-01'),
        },
      ]).then(onfulfilled),
    );
  }

  function setupReviewInsertResult() {
    mockTx.returning.mockImplementationOnce(() => ({
      then: (onfulfilled: any) => Promise.resolve([{ id: 55 }]).then(onfulfilled),
    }));
  }

  it('should return success true when logAuditEvent throws', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    vi.mocked(logAuditEvent).mockRejectedValueOnce(new Error('audit logging failed'));
    setupPassSubmission();

    const result = await submitReviewHandler({
      data: { submissionId: 1, decision: 'pass', comment: 'Well done!' },
    });

    expect(result).toEqual({ success: true });
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(logAuditEvent).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'advisory_failed', handler: 'submitReviewHandler' }),
    );
  });

  it('should return success true when dispatchSLABreachNotifications throws', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    vi.mocked(dispatchSLABreachNotifications).mockRejectedValueOnce(
      new Error('notification dispatch failed'),
    );
    setupPassSubmission();

    const result = await submitReviewHandler({
      data: { submissionId: 1, decision: 'pass', comment: 'Well done!' },
    });

    expect(result).toEqual({ success: true });
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(dispatchSLABreachNotifications).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'advisory_failed', handler: 'submitReviewHandler' }),
    );
  });

  it('should log advisory failures to logger.error', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    const advisoryError = new Error('audit logging failed');
    vi.mocked(logAuditEvent).mockRejectedValueOnce(advisoryError);
    setupPassSubmission();

    await submitReviewHandler({
      data: { submissionId: 1, decision: 'pass', comment: 'Well done!' },
    });

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'advisory_failed',
        handler: 'submitReviewHandler',
        error: advisoryError.message,
      }),
    );
  });

  it('should still commit the transaction when advisory work throws', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    vi.mocked(logAuditEvent).mockRejectedValueOnce(new Error('audit logging failed'));
    setupPassSubmission();

    await submitReviewHandler({
      data: { submissionId: 1, decision: 'pass', comment: 'Well done!' },
    });

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });

  it('should still fire audit log and SLA notifications in the normal case', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    setupPassSubmission();

    const result = await submitReviewHandler({
      data: { submissionId: 1, decision: 'pass', comment: 'Well done!' },
    });

    expect(result).toEqual({ success: true });
    expect(logAuditEvent).toHaveBeenCalledTimes(1);
    expect(dispatchSLABreachNotifications).toHaveBeenCalledTimes(1);
  });

  it('should insert ordered action items for a Revise review', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    setupNoBreachSubmission();
    setupReviewInsertResult();

    const result = await submitReviewHandler({
      data: {
        submissionId: 1,
        decision: 'revise',
        revisionDeadline: '2026-08-15',
        actionItems: [
          { itemText: 'Rewrite the conclusion' },
          { itemText: 'Add supporting evidence' },
        ],
      } as any,
    });

    expect(result).toEqual({ success: true });
    expect(mockTx.insert).toHaveBeenCalledWith(revisionActionItems);
    const actionItemValues = mockTx.values.mock.calls
      .map((call: any[]) => call[0])
      .find(
        (values: unknown) =>
          Array.isArray(values) &&
          values.some((value) => value.itemText === 'Rewrite the conclusion'),
      );
    expect(actionItemValues).toEqual([
      {
        reviewId: 55,
        itemText: 'Rewrite the conclusion',
        order: 0,
        criterionId: null,
        criterionTitle: null,
      },
      {
        reviewId: 55,
        itemText: 'Add supporting evidence',
        order: 1,
        criterionId: null,
        criterionTitle: null,
      },
    ]);
  });

  it('should reject action items on a Pass review before writing', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    setupNoBreachSubmission();

    const result = await submitReviewHandler({
      data: {
        submissionId: 1,
        decision: 'pass',
        comment: 'Well done',
        actionItems: [{ itemText: 'This must not be stored' }],
      } as any,
    });

    expect(result).toMatchObject({ error: { code: 'BAD_REQUEST' } });
    expect(mockTx.insert).not.toHaveBeenCalledWith(revisionActionItems);
  });

  it('should preserve comment-only Revise submissions without action items', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    setupNoBreachSubmission();

    const result = await submitReviewHandler({
      data: {
        submissionId: 1,
        decision: 'revise',
        comment: 'Please clarify the methodology',
        revisionDeadline: '2026-08-15',
      },
    });

    expect(result).toEqual({ success: true });
    expect(mockTx.insert).not.toHaveBeenCalledWith(revisionActionItems);
  });

  it('should preserve file-only Revise submissions without action items', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    setupNoBreachSubmission();
    mockTx.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([
        {
          userId: 'instructor-1',
          purpose: 'review_feedback',
          checkpointId: null,
          consumedAt: null,
          expiresAt: new Date('2026-12-01'),
        },
      ]).then(onfulfilled),
    );

    const result = await submitReviewHandler({
      data: {
        submissionId: 1,
        decision: 'revise',
        comment: '',
        feedbackFileKey: 'feedback/review.pdf',
        revisionDeadline: '2026-08-15',
      },
    });

    expect(result).toEqual({ success: true });
    expect(getObjectContentLength).toHaveBeenCalledWith({ key: 'feedback/review.pdf' });
    expect(mockTx.insert).not.toHaveBeenCalledWith(revisionActionItems);
  });

  it('should roll back the review transaction when action-item insertion fails', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    setupNoBreachSubmission();
    setupReviewInsertResult();
    mockTx.insert.mockImplementation((table: unknown) => {
      if (table === revisionActionItems) throw new Error('action-item insert failed');
      return mockTx;
    });

    const result = await submitReviewHandler({
      data: {
        submissionId: 1,
        decision: 'revise',
        revisionDeadline: '2026-08-15',
        actionItems: [{ itemText: 'Rewrite the conclusion' }],
      } as any,
    });

    expect(result).toMatchObject({ error: { code: 'INTERNAL' } });
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.insert).toHaveBeenCalledWith(revisionActionItems);
  });

  // --- checkAndFireRiskAlert integration ---

  it('should call checkAndFireRiskAlert on revise decision', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    setupNoBreachSubmission();

    await submitReviewHandler({
      data: {
        submissionId: 1,
        decision: 'revise',
        comment: 'Needs work',
        revisionDeadline: '2026-08-15',
      },
    });

    expect(checkAndFireRiskAlert).toHaveBeenCalledTimes(1);
    expect(checkAndFireRiskAlert).toHaveBeenCalledWith(expect.any(Object), {
      studentId: 'student-1',
      studentName: 'Alice',
      assignmentId: 1,
      assignmentTitle: 'Thesis 2026',
      instructorId: 'instructor-1',
    });
  });

  it('should not call checkAndFireRiskAlert on pass decision without SLA breach', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    setupNoBreachSubmission();

    await submitReviewHandler({
      data: { submissionId: 1, decision: 'pass', comment: 'Well done!' },
    });

    expect(checkAndFireRiskAlert).not.toHaveBeenCalled();
  });

  it('should call checkAndFireRiskAlert on SLA breach even with pass decision', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    setupPassSubmission(7);

    await submitReviewHandler({
      data: { submissionId: 1, decision: 'pass', comment: 'Well done!' },
    });

    expect(checkAndFireRiskAlert).toHaveBeenCalledTimes(1);
  });

  it('should return success true when checkAndFireRiskAlert throws', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    vi.mocked(checkAndFireRiskAlert).mockRejectedValueOnce(new Error('risk alert failed'));
    setupNoBreachSubmission();

    const result = await submitReviewHandler({
      data: {
        submissionId: 1,
        decision: 'revise',
        comment: 'Needs work',
        revisionDeadline: '2026-08-15',
      },
    });

    expect(result).toEqual({ success: true });
    expect(checkAndFireRiskAlert).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'advisory_failed', handler: 'maybeFireReviewRiskAlert' }),
    );
  });
});
