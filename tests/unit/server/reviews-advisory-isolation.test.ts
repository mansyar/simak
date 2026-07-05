/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitReviewHandler } from '@/server/reviews.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import { logAuditEvent } from '@/lib/audit';
import { dispatchSLABreachNotifications } from '@/lib/review-sla';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
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

  it('should return success true when logAuditEvent throws', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    vi.mocked(logAuditEvent).mockRejectedValueOnce(new Error('audit logging failed'));
    setupPassSubmission();

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await submitReviewHandler({
      data: { submissionId: 1, decision: 'pass', comment: 'Well done!' },
    });

    expect(result).toEqual({ success: true });
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(logAuditEvent).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      'Post-commit advisory work failed in submitReviewHandler:',
      expect.any(Error),
    );

    errorSpy.mockRestore();
  });

  it('should return success true when dispatchSLABreachNotifications throws', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    vi.mocked(dispatchSLABreachNotifications).mockRejectedValueOnce(
      new Error('notification dispatch failed'),
    );
    setupPassSubmission();

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await submitReviewHandler({
      data: { submissionId: 1, decision: 'pass', comment: 'Well done!' },
    });

    expect(result).toEqual({ success: true });
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(dispatchSLABreachNotifications).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      'Post-commit advisory work failed in submitReviewHandler:',
      expect.any(Error),
    );

    errorSpy.mockRestore();
  });

  it('should log advisory failures to console.error', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    const advisoryError = new Error('audit logging failed');
    vi.mocked(logAuditEvent).mockRejectedValueOnce(advisoryError);
    setupPassSubmission();

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await submitReviewHandler({
      data: { submissionId: 1, decision: 'pass', comment: 'Well done!' },
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      'Post-commit advisory work failed in submitReviewHandler:',
      advisoryError,
    );

    errorSpy.mockRestore();
  });

  it('should still commit the transaction when advisory work throws', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    vi.mocked(logAuditEvent).mockRejectedValueOnce(new Error('audit logging failed'));
    setupPassSubmission();

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await submitReviewHandler({
      data: { submissionId: 1, decision: 'pass', comment: 'Well done!' },
    });

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
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
});
