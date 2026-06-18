/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eq, and } from 'drizzle-orm';

// Mock auth
vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

// Mock db
vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

// Mock schema
vi.mock('@/db/schema/assignments', () => ({
  checkpoints: {
    id: 'checkpoints_id',
    state: 'checkpoints_state',
    studentId: 'checkpoints_studentId',
  },
  assignmentStudents: {
    assignmentId: 'assignment_students_assignmentId',
    studentId: 'assignment_students_studentId',
  },
}));

vi.mock('@/db/schema/submissions', () => ({
  submissions: {
    id: 'submissions_id',
    fileKey: 'submissions_fileKey',
    uploadedBy: 'submissions_uploadedBy',
  },
}));

// Mock lib/storage
vi.mock('@/lib/storage', () => ({
  generateFileKey: vi
    .fn()
    .mockImplementation((ext: string, prefix = 'submissions') => `${prefix}/mock-uuid.${ext}`),
  generatePresignedUploadUrl: vi.fn().mockResolvedValue('https://r2.example.com/upload'),
  generatePresignedDownloadUrl: vi.fn().mockResolvedValue('https://r2.example.com/download'),
}));

import { getSessionFromHeaders } from '@/server/auth';
import { getDb } from '@/db/index';
import {
  generateFileKey,
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
} from '@/lib/storage';

function mockDbQuery(rows: any[]) {
  const limitStep: any = {
    then: (fn: (v: any[]) => any) => Promise.resolve(rows).then(fn),
  };
  const whereStep: any = {
    limit: vi.fn().mockReturnValue(limitStep),
    then: (fn: (v: any[]) => any) => Promise.resolve(rows).then(fn),
  };
  const innerJoinStep: any = {
    where: vi.fn().mockReturnValue(whereStep),
    then: (fn: (v: any[]) => any) => Promise.resolve(rows).then(fn),
  };
  const fromStep: any = {
    innerJoin: vi.fn().mockReturnValue(innerJoinStep),
    where: vi.fn().mockReturnValue(whereStep),
    then: (fn: (v: any[]) => any) => Promise.resolve(rows).then(fn),
  };
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue(fromStep),
    }),
    eq,
    and,
  };
}

describe('files.server.ts - getPresignedUploadUrlHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject non-student users', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue({
      user: {
        id: 'user-1',
        name: 'Test',
        email: 'test@test.com',
        role: 'instructor',
        locale: 'en',
        emailVerified: true,
      },
      session: { id: 's-1', token: 't-1', expiresAt: new Date() },
    });

    const { getPresignedUploadUrlHandler } = await import('@/server/files.server');
    const result = await getPresignedUploadUrlHandler({
      data: { checkpointId: 1, contentType: 'application/pdf', extension: 'pdf' },
    });
    expect(result).toEqual({ error: 'Unauthorized' });
  });

  it('should reject when checkpoint not found', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue({
      user: {
        id: 'student-1',
        name: 'Student',
        email: 's@t.com',
        role: 'student',
        locale: 'en',
        emailVerified: true,
      },
      session: { id: 's-1', token: 't-1', expiresAt: new Date() },
    });

    const mockDb = mockDbQuery([]);
    vi.mocked(getDb).mockReturnValue(mockDb as any);

    const { getPresignedUploadUrlHandler } = await import('@/server/files.server');
    const result = await getPresignedUploadUrlHandler({
      data: { checkpointId: 999, contentType: 'application/pdf', extension: 'pdf' },
    });
    expect(result).toEqual({ error: 'Checkpoint not found' });
  });

  it('should reject when checkpoint is not in a submittable state', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue({
      user: {
        id: 'student-1',
        name: 'Student',
        email: 's@t.com',
        role: 'student',
        locale: 'en',
        emailVerified: true,
      },
      session: { id: 's-1', token: 't-1', expiresAt: new Date() },
    });

    const mockDb = mockDbQuery([{ id: 1, state: 'passed' }]);
    vi.mocked(getDb).mockReturnValue(mockDb as any);

    const { getPresignedUploadUrlHandler } = await import('@/server/files.server');
    const result = await getPresignedUploadUrlHandler({
      data: { checkpointId: 1, contentType: 'application/pdf', extension: 'pdf' },
    });
    expect(result).toEqual({ error: 'Checkpoint is not in a submittable state' });
  });

  it('should reject unsupported file extension', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue({
      user: {
        id: 'student-1',
        name: 'Student',
        email: 's@t.com',
        role: 'student',
        locale: 'en',
        emailVerified: true,
      },
      session: { id: 's-1', token: 't-1', expiresAt: new Date() },
    });

    const mockDb = mockDbQuery([{ id: 1, state: 'unlocked' }]);
    vi.mocked(getDb).mockReturnValue(mockDb as any);

    const { getPresignedUploadUrlHandler } = await import('@/server/files.server');
    const result = await getPresignedUploadUrlHandler({
      data: { checkpointId: 1, contentType: 'image/png', extension: 'png' },
    });
    expect(result).toEqual({ error: 'Unsupported file extension' });
  });

  it('should reject content type that does not match extension', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue({
      user: {
        id: 'student-1',
        name: 'Student',
        email: 's@t.com',
        role: 'student',
        locale: 'en',
        emailVerified: true,
      },
      session: { id: 's-1', token: 't-1', expiresAt: new Date() },
    });

    const mockDb = mockDbQuery([{ id: 1, state: 'unlocked' }]);
    vi.mocked(getDb).mockReturnValue(mockDb as any);

    const { getPresignedUploadUrlHandler } = await import('@/server/files.server');
    const result = await getPresignedUploadUrlHandler({
      data: {
        checkpointId: 1,
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extension: 'pdf',
      },
    });
    expect(result).toEqual({ error: 'Content type does not match file extension' });
  });

  it('should return upload URL for unlocked checkpoint', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue({
      user: {
        id: 'student-1',
        name: 'Student',
        email: 's@t.com',
        role: 'student',
        locale: 'en',
        emailVerified: true,
      },
      session: { id: 's-1', token: 't-1', expiresAt: new Date() },
    });

    const mockDb = mockDbQuery([{ id: 1, state: 'unlocked' }]);
    vi.mocked(getDb).mockReturnValue(mockDb as any);

    const { getPresignedUploadUrlHandler } = await import('@/server/files.server');
    const result = await getPresignedUploadUrlHandler({
      data: { checkpointId: 1, contentType: 'application/pdf', extension: 'pdf' },
    });

    expect(result).toEqual({
      uploadUrl: 'https://r2.example.com/upload',
      fileKey: 'submissions/mock-uuid.pdf',
    });
    expect(generateFileKey).toHaveBeenCalledWith('pdf');
    expect(generatePresignedUploadUrl).toHaveBeenCalledWith({
      key: 'submissions/mock-uuid.pdf',
      contentType: 'application/pdf',
    });
  });

  it('should return upload URL for revise checkpoint', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue({
      user: {
        id: 'student-1',
        name: 'Student',
        email: 's@t.com',
        role: 'student',
        locale: 'en',
        emailVerified: true,
      },
      session: { id: 's-1', token: 't-1', expiresAt: new Date() },
    });

    const mockDb = mockDbQuery([{ id: 1, state: 'revise' }]);
    vi.mocked(getDb).mockReturnValue(mockDb as any);

    const { getPresignedUploadUrlHandler } = await import('@/server/files.server');
    const result = await getPresignedUploadUrlHandler({
      data: {
        checkpointId: 1,
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extension: 'docx',
      },
    });

    expect(result).toEqual({
      uploadUrl: 'https://r2.example.com/upload',
      fileKey: 'submissions/mock-uuid.docx',
    });
  });
});

describe('files.server.ts - getPresignedDownloadUrlHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject non-student users', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue({
      user: {
        id: 'user-1',
        name: 'Test',
        email: 'test@test.com',
        role: 'instructor',
        locale: 'en',
        emailVerified: true,
      },
      session: { id: 's-1', token: 't-1', expiresAt: new Date() },
    });

    const { getPresignedDownloadUrlHandler } = await import('@/server/files.server');
    const result = await getPresignedDownloadUrlHandler({ data: { submissionId: 1 } });
    expect(result).toEqual({ error: 'Unauthorized' });
  });

  it('should reject when submission not found', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue({
      user: {
        id: 'student-1',
        name: 'Student',
        email: 's@t.com',
        role: 'student',
        locale: 'en',
        emailVerified: true,
      },
      session: { id: 's-1', token: 't-1', expiresAt: new Date() },
    });

    const submissionDb = mockDbQuery([]);
    vi.mocked(getDb).mockReturnValue(submissionDb as any);

    const { getPresignedDownloadUrlHandler } = await import('@/server/files.server');
    const result = await getPresignedDownloadUrlHandler({ data: { submissionId: 999 } });
    expect(result).toEqual({ error: 'Submission not found' });
  });

  it('should return download URL for student submission', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue({
      user: {
        id: 'student-1',
        name: 'Student',
        email: 's@t.com',
        role: 'student',
        locale: 'en',
        emailVerified: true,
      },
      session: { id: 's-1', token: 't-1', expiresAt: new Date() },
    });

    const submissionDb = mockDbQuery([
      { id: 1, fileKey: 'submissions/test-file.pdf', uploadedBy: 'student-1' },
    ]);
    vi.mocked(getDb).mockReturnValue(submissionDb as any);

    const { getPresignedDownloadUrlHandler } = await import('@/server/files.server');
    const result = await getPresignedDownloadUrlHandler({ data: { submissionId: 1 } });

    expect(result).toEqual({ downloadUrl: 'https://r2.example.com/download' });
    expect(generatePresignedDownloadUrl).toHaveBeenCalledWith({ key: 'submissions/test-file.pdf' });
  });

  it('should reject submission from other student', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue({
      user: {
        id: 'student-2',
        name: 'Other Student',
        email: 'o@t.com',
        role: 'student',
        locale: 'en',
        emailVerified: true,
      },
      session: { id: 's-2', token: 't-2', expiresAt: new Date() },
    });

    const submissionDb = mockDbQuery([]);
    vi.mocked(getDb).mockReturnValue(submissionDb as any);

    const { getPresignedDownloadUrlHandler } = await import('@/server/files.server');
    const result = await getPresignedDownloadUrlHandler({ data: { submissionId: 1 } });
    expect(result).toEqual({ error: 'Submission not found' });
  });
});

describe('files.server.ts - getPresignedReviewFeedbackUploadUrlHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject non-instructor users', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue({
      user: {
        id: 'user-1',
        name: 'Test',
        email: 'test@test.com',
        role: 'student',
        locale: 'en',
        emailVerified: true,
      },
      session: { id: 's-1', token: 't-1', expiresAt: new Date() },
    });

    const { getPresignedReviewFeedbackUploadUrlHandler } = await import('@/server/files.server');
    const result = await getPresignedReviewFeedbackUploadUrlHandler({
      data: { extension: 'pdf', contentType: 'application/pdf' },
    });
    expect(result).toEqual({ error: 'Unauthorized' });
  });

  it('should return upload URL for instructor feedback', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue({
      user: {
        id: 'instructor-1',
        name: 'Instructor',
        email: 'i@t.com',
        role: 'instructor',
        locale: 'en',
        emailVerified: true,
      },
      session: { id: 's-1', token: 't-1', expiresAt: new Date() },
    });

    const { getPresignedReviewFeedbackUploadUrlHandler } = await import('@/server/files.server');
    const result = await getPresignedReviewFeedbackUploadUrlHandler({
      data: { extension: 'pdf', contentType: 'application/pdf' },
    });

    expect(result).toEqual({
      uploadUrl: 'https://r2.example.com/upload',
      fileKey: 'feedback/mock-uuid.pdf',
    });
    expect(generateFileKey).toHaveBeenCalledWith('pdf', 'feedback');
  });
});
