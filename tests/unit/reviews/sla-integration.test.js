/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitReviewHandler } from '@/server/reviews.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import * as sla from '@/lib/sla';
import { emailQueue } from '@/db/schema/index';
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
  let mockDb;
  let mockTx;
  const instructorSession = {
    user: { id: 'instructor-1', role: 'instructor' },
    session: {},
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
      then: vi.fn((onfulfilled) => Promise.resolve([]).then(onfulfilled)),
    };
  }
  beforeEach(() => {
    vi.clearAllMocks();
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
      transaction: vi.fn((cb) => cb(mockTx)),
      then: vi.fn((onfulfilled) => Promise.resolve([]).then(onfulfilled)),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb);
  });
  it('should trigger SLA breach flow for a late review (notifications + email + deadline adjustment)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
    vi.mocked(sla.calculateBreachDuration).mockReturnValue(3);
    // Initial query: submission data
    mockDb.then.mockImplementationOnce((onfulfilled) =>
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
    mockDb.then.mockImplementationOnce((onfulfilled) =>
      Promise.resolve([
        { id: 'admin-1', name: 'Admin One', email: 'admin1@test.com' },
        { id: 'admin-2', name: 'Admin Two', email: 'admin2@test.com' },
      ]).then(onfulfilled),
    );
    // Transaction: no subsequent checkpoints
    mockTx.then.mockImplementation((onfulfilled) => Promise.resolve([]).then(onfulfilled));
    // Also mock notification insert returning
    mockTx.returning.mockResolvedValue([{ id: 1 }]);
    await submitReviewHandler({
      data: { submissionId: 1, decision: 'pass', comment: 'Well done!' },
    });
    // Should have called calculateBreachDuration
    expect(sla.calculateBreachDuration).toHaveBeenCalled();
    // Should have enqueued SLA alert emails (insert into email_queue)
    expect(mockDb.insert).toHaveBeenCalledWith(emailQueue);
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        templateType: 'sla_alert',
        status: 'pending',
      }),
    );
  });
  it('should NOT trigger SLA breach for on-time review', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
    vi.mocked(sla.calculateBreachDuration).mockReturnValue(0);
    // Initial query: submission data
    mockDb.then.mockImplementationOnce((onfulfilled) =>
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
    mockTx.then.mockImplementation((onfulfilled) => Promise.resolve([]).then(onfulfilled));
    await submitReviewHandler({
      data: { submissionId: 1, decision: 'pass', comment: 'Good work!' },
    });
    // Should not have enqueued any SLA emails
    expect(mockDb.values).not.toHaveBeenCalled();
  });
  it('should send SLA email with correct details per admin', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
    vi.mocked(sla.calculateBreachDuration).mockReturnValue(2);
    // Initial query
    mockDb.then
      .mockImplementationOnce((onfulfilled) =>
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
      .mockImplementationOnce((onfulfilled) =>
        Promise.resolve([{ id: 'admin-1', name: 'Admin One', email: 'admin1@test.com' }]).then(
          onfulfilled,
        ),
      );
    mockTx.then.mockImplementation((onfulfilled) => Promise.resolve([]).then(onfulfilled));
    // Notification insert mock
    mockTx.returning.mockResolvedValue([{ id: 1 }]);
    await submitReviewHandler({
      data: { submissionId: 1, decision: 'pass', comment: 'Nice work!' },
    });
    // Verify enqueued email content
    expect(mockDb.insert).toHaveBeenCalledWith(emailQueue);
    // Find the values call with SLA alert data (among many other DB values calls)
    const slaCall = mockDb.values.mock.calls.find(
      (call) => call[0]?.templateType === 'sla_alert',
    )?.[0];
    expect(slaCall).toBeDefined();
    expect(slaCall.recipientEmail).toBe('admin1@test.com');
    expect(slaCall.subject).toContain('SLA Breach Alert');
    expect(slaCall.bodyHtml).toContain('2 days');
    expect(slaCall.templateType).toBe('sla_alert');
    expect(slaCall.status).toBe('pending');
  });
});
