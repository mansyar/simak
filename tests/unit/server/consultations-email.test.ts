/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/lifecycle-risk-capture.server', () => ({
  captureLifecycleRiskObservation: vi.fn(),
}));
import {
  verifyConsultationHandler,
  rejectConsultationHandler,
} from '@/server/consultations.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import { enqueueEmail, resolveEmailRecipient } from '@/lib/email';
import {
  buildConsultationVerifiedHtml,
  buildConsultationRejectedHtml,
} from '@/lib/email-templates';
import { logger } from '@/lib/logger';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/email', () => ({
  enqueueEmail: vi.fn().mockResolvedValue(undefined),
  resolveEmailRecipient: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/email-templates', () => ({
  buildConsultationVerifiedHtml: vi.fn().mockReturnValue('<html>verified body</html>'),
  buildConsultationRejectedHtml: vi.fn().mockReturnValue('<html>rejected body</html>'),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}));

describe('Consultation email enqueue', () => {
  let mockDb: any;
  let mockTx: any;

  const instructorSession = {
    user: { id: 'instructor-1', name: 'Prof. Smith', role: 'instructor' as const },
    session: {} as any,
  };

  const consultationRow = {
    id: 1,
    status: 'pending',
    studentId: 'student-1',
    assignmentId: 101,
    instructorId: 'instructor-1',
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

  function setupSuccessfulConsultation() {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    // Inside transaction: fetchConsultationForUpdate returns consultation row
    mockTx.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([consultationRow]).then(onfulfilled),
    );

    // Post-commit: sendConsultationEmail queries checkpoint name
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ checkpointName: 'Chapter 1' }]).then(onfulfilled),
    );
  }

  it('should enqueue consultation_verified email to student on verify', async () => {
    setupSuccessfulConsultation();
    vi.mocked(resolveEmailRecipient).mockResolvedValue({
      email: 'student@test.com',
      locale: 'en',
    });
    vi.mocked(buildConsultationVerifiedHtml).mockReturnValue('<html>verified body</html>');

    const result = await verifyConsultationHandler({ data: { consultationId: 1 } });

    expect(result).toEqual({ success: true });

    expect(resolveEmailRecipient).toHaveBeenCalledWith('student-1');
    expect(buildConsultationVerifiedHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        instructorName: 'Prof. Smith',
        checkpointName: 'Chapter 1',
        assignmentId: 101,
        locale: 'en',
      }),
    );
    expect(enqueueEmail).toHaveBeenCalledWith({
      recipientEmail: 'student@test.com',
      subject: '[SIMAK] Consultation Verified',
      bodyHtml: '<html>verified body</html>',
      templateType: 'consultation_verified',
    });
  });

  it('should enqueue consultation_rejected email to student on reject', async () => {
    setupSuccessfulConsultation();
    vi.mocked(resolveEmailRecipient).mockResolvedValue({
      email: 'student@test.com',
      locale: 'en',
    });
    vi.mocked(buildConsultationRejectedHtml).mockReturnValue('<html>rejected body</html>');

    const result = await rejectConsultationHandler({
      data: { consultationId: 1, reason: 'Insufficient evidence' },
    });

    expect(result).toEqual({ success: true });

    expect(resolveEmailRecipient).toHaveBeenCalledWith('student-1');
    expect(buildConsultationRejectedHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        instructorName: 'Prof. Smith',
        checkpointName: 'Chapter 1',
        assignmentId: 101,
        rejectionReason: 'Insufficient evidence',
        locale: 'en',
      }),
    );
    expect(enqueueEmail).toHaveBeenCalledWith({
      recipientEmail: 'student@test.com',
      subject: '[SIMAK] Consultation Rejected',
      bodyHtml: '<html>rejected body</html>',
      templateType: 'consultation_rejected',
    });
  });

  it('should localize email subject for Indonesian student', async () => {
    setupSuccessfulConsultation();
    vi.mocked(resolveEmailRecipient).mockResolvedValue({
      email: 'student@test.com',
      locale: 'id',
    });

    await verifyConsultationHandler({ data: { consultationId: 1 } });

    expect(enqueueEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: '[SIMAK] Konsultasi Diverifikasi',
      }),
    );
  });

  it('should succeed even when enqueueEmail throws (advisory-only)', async () => {
    setupSuccessfulConsultation();
    vi.mocked(resolveEmailRecipient).mockResolvedValue({
      email: 'student@test.com',
      locale: 'en',
    });
    vi.mocked(enqueueEmail).mockRejectedValueOnce(new Error('email service down'));

    const result = await verifyConsultationHandler({ data: { consultationId: 1 } });

    expect(result).toEqual({ success: true });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'advisory_failed' }),
    );
  });

  it('should skip email when student is soft-deleted or has no verified email', async () => {
    setupSuccessfulConsultation();
    vi.mocked(resolveEmailRecipient).mockResolvedValue(null);

    const result = await verifyConsultationHandler({ data: { consultationId: 1 } });

    expect(result).toEqual({ success: true });
    expect(enqueueEmail).not.toHaveBeenCalled();
  });
});
