/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitReviewHandler } from '@/server/reviews.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import * as sla from '@/lib/sla';
import { Resend } from 'resend';

// Mock email
const { sendMock, MockResend: MockResendClass } = vi.hoisted(() => {
  const send = vi.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null });
  class MockResend {
    emails = { send };
  }
  return { sendMock: send, MockResend: MockResend };
});

vi.mock('resend', () => ({
  Resend: MockResendClass,
}));

vi.mock('@/config/env', () => ({
  getEnv: vi.fn().mockReturnValue({
    RESEND_API_KEY: 'test-key',
    BETTER_AUTH_URL: 'http://localhost:3000',
  }),
}));

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/sla', () => ({
  calculateBreachDuration: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock('@/lib/storage', () => ({
  generateFileKey: vi.fn().mockReturnValue('feedback/test-uuid.pdf'),
  generatePresignedUploadUrl: vi.fn().mockResolvedValue('https://presigned-upload.test/url'),
  generatePresignedDownloadUrl: vi.fn().mockResolvedValue('https://presigned-download.test/url'),
  getR2Client: vi.fn().mockReturnValue({}),
}));

describe('SLA Integration — Full Flow', () => {
  let mockDb: any;
  let mockTx: any;
  const instructorSession = {
    user: { id: 'instructor-1', role: 'instructor' as const },
    session: {} as any,
  };

  function makeMockTx() {
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
      returning: vi.fn().mockReturnThis(),
      then: vi.fn((onfulfilled: any) => Promise.resolve([]).then(onfulfilled)),
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    sendMock.mockClear();

    mockTx = makeMockTx();

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
      transaction: vi.fn((cb: (tx: any) => Promise<any>) => cb(mockTx)),
      then: vi.fn((onfulfilled: any) => Promise.resolve([]).then(onfulfilled)),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  it('should trigger SLA breach flow for a late review (notifications + email + deadline adjustment)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    vi.mocked(sla.calculateBreachDuration).mockReturnValue(3);

    // Initial query: submission data
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([
        {
          checkpointId: 100,
          checkpointState: 'under_review',
          assignmentId: 1,
          instructorId: 'instructor-1',
          studentId: 'student-1',
          checkpointUpdatedAt: new Date('2026-05-10T10:00:00Z'),
          checkpointDueDate: new Date('2026-06-01T00:00:00Z'),
          checkpointOrder: 1,
          finalDeadline: new Date('2026-07-01T00:00:00Z'),
        },
      ]).then(onfulfilled),
    );

    // Admin users query: returns admin list
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([
        { id: 'admin-1', name: 'Admin One', email: 'admin1@test.com' },
        { id: 'admin-2', name: 'Admin Two', email: 'admin2@test.com' },
      ]).then(onfulfilled),
    );

    // Transaction: no subsequent checkpoints
    mockTx.then.mockImplementation((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    // Also mock notification insert returning
    mockTx.returning.mockResolvedValue([{ id: 1 }]);

    await submitReviewHandler({
      data: { submissionId: 1, decision: 'pass', comment: 'Well done!' },
    });

    // Should have called calculateBreachDuration
    expect(sla.calculateBreachDuration).toHaveBeenCalled();
    // Should have sent an SLA alert email (to each admin)
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it('should NOT trigger SLA breach for on-time review', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    vi.mocked(sla.calculateBreachDuration).mockReturnValue(0);

    // Initial query: submission data
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([
        {
          checkpointId: 100,
          checkpointState: 'under_review',
          assignmentId: 1,
          instructorId: 'instructor-1',
          studentId: 'student-1',
          checkpointUpdatedAt: new Date('2026-05-20T10:00:00Z'),
          checkpointDueDate: new Date('2026-06-01T00:00:00Z'),
          checkpointOrder: 1,
          finalDeadline: new Date('2026-07-01T00:00:00Z'),
        },
      ]).then(onfulfilled),
    );

    mockTx.then.mockImplementation((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    await submitReviewHandler({
      data: { submissionId: 1, decision: 'pass', comment: 'Good work!' },
    });

    // Should not have sent any SLA emails
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('should send SLA email with correct details per admin', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    vi.mocked(sla.calculateBreachDuration).mockReturnValue(2);

    // Initial query
    mockDb.then
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            checkpointId: 100,
            checkpointState: 'under_review',
            assignmentId: 1,
            instructorId: 'instructor-1',
            studentId: 'student-1',
            checkpointUpdatedAt: new Date('2026-05-20T10:00:00Z'),
            checkpointDueDate: new Date('2026-06-01T00:00:00Z'),
            checkpointOrder: 1,
            finalDeadline: new Date('2026-07-01T00:00:00Z'),
          },
        ]).then(onfulfilled),
      )
      // Admin users
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ id: 'admin-1', name: 'Admin One', email: 'admin1@test.com' }]).then(
          onfulfilled,
        ),
      );

    mockTx.then.mockImplementation((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));
    // Notification insert mock
    mockTx.returning.mockResolvedValue([{ id: 1 }]);

    await submitReviewHandler({
      data: { submissionId: 1, decision: 'pass', comment: 'Nice work!' },
    });

    // Verify email content
    const emailCall = sendMock.mock.calls[0][0];
    expect(emailCall.to).toBe('admin1@test.com');
    expect(emailCall.subject).toContain('SLA Breach Alert');
    expect(emailCall.html).toContain('2 days');
  });
});
