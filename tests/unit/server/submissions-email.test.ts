/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitCheckpointHandler } from '@/server/submissions.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import { enqueueEmail, resolveEmailRecipient } from '@/lib/email';
import { buildSubmissionReceivedHtml } from '@/lib/email-templates';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/email', () => ({
  enqueueEmail: vi.fn().mockResolvedValue(undefined),
  resolveEmailRecipient: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/email-templates', () => ({
  buildSubmissionReceivedHtml: vi.fn().mockReturnValue('<html>body</html>'),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

vi.mock('@/lib/storage', () => ({
  generateFileKey: vi.fn(),
  generatePresignedUploadUrl: vi.fn(),
  generatePresignedDownloadUrl: vi.fn(),
  getR2Client: vi.fn(),
  getObjectContentLength: vi.fn().mockResolvedValue({ ok: true, size: 1024 }),
}));

const validIntentRow = {
  fileKey: 'submissions/uuid-123.pdf',
  userId: 'student-1',
  purpose: 'submission',
  checkpointId: 1,
  consumedAt: null,
};

function enqueueIntentSuccess(db: any) {
  db.then
    .mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([validIntentRow]).then(onfulfilled),
    )
    .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));
}

describe('Submission email enqueue', () => {
  let mockDb: any;
  const submitData = {
    checkpointId: 1,
    fileKey: 'submissions/uuid-123.pdf',
    fileName: 'chapter1.pdf',
    fileSize: 1024,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      for: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      then: vi.fn(function (onfulfilled: any) {
        return Promise.resolve([]).then(onfulfilled);
      }),
    };
    mockDb.transaction = vi.fn().mockImplementation(async (callback: any) => {
      return callback(mockDb);
    });
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  function setupSuccessfulSubmission() {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: 'student-1', name: 'Test Student', role: 'student' },
      session: {} as any,
    } as any);

    mockDb.returning.mockReturnValueOnce({
      then: (onfulfilled: any) => Promise.resolve([{ id: 123 }]).then(onfulfilled),
    });

    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([
        {
          id: 1,
          assignmentId: 101,
          studentId: 'student-1',
          name: 'Chapter 1',
          state: 'unlocked',
        },
      ]).then(onfulfilled),
    );

    enqueueIntentSuccess(mockDb);
    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ instructorId: 'instructor-1', assignmentTitle: 'Thesis 2026' }]).then(
          onfulfilled,
        ),
      );
  }

  it('should enqueue submission_received email to instructor on successful submission', async () => {
    setupSuccessfulSubmission();
    vi.mocked(resolveEmailRecipient).mockResolvedValue({
      email: 'instructor@test.com',
      locale: 'en',
    });
    vi.mocked(buildSubmissionReceivedHtml).mockReturnValue('<html>email body</html>');

    const result = await submitCheckpointHandler({ data: submitData });
    expect(result).toEqual({ success: true });

    expect(resolveEmailRecipient).toHaveBeenCalledWith('instructor-1');
    expect(buildSubmissionReceivedHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        studentName: 'Test Student',
        assignmentName: 'Thesis 2026',
        checkpointName: 'Chapter 1',
        submissionId: 123,
        locale: 'en',
      }),
    );
    expect(enqueueEmail).toHaveBeenCalledWith({
      recipientEmail: 'instructor@test.com',
      subject: '[SIMAK] Submission Received',
      bodyHtml: '<html>email body</html>',
      templateType: 'submission_received',
    });
  });

  it('should localize email subject for Indonesian instructor', async () => {
    setupSuccessfulSubmission();
    vi.mocked(resolveEmailRecipient).mockResolvedValue({
      email: 'instructor@test.com',
      locale: 'id',
    });
    vi.mocked(buildSubmissionReceivedHtml).mockReturnValue('<html>email body</html>');

    await submitCheckpointHandler({ data: submitData });

    expect(enqueueEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: '[SIMAK] Pengumpulan Tugas Diterima',
      }),
    );
  });

  it('should succeed even when enqueueEmail throws (advisory-only)', async () => {
    setupSuccessfulSubmission();
    vi.mocked(resolveEmailRecipient).mockResolvedValue({
      email: 'instructor@test.com',
      locale: 'en',
    });
    vi.mocked(enqueueEmail).mockRejectedValueOnce(new Error('email service down'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await submitCheckpointHandler({ data: submitData });

    expect(result).toEqual({ success: true });
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to enqueue submission_received email:',
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });

  it('should skip email when instructor is soft-deleted or has no verified email', async () => {
    setupSuccessfulSubmission();
    vi.mocked(resolveEmailRecipient).mockResolvedValue(null);

    const result = await submitCheckpointHandler({ data: submitData });

    expect(result).toEqual({ success: true });
    expect(enqueueEmail).not.toHaveBeenCalled();
  });
});
