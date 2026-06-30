/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock auth
vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

// Mock db
vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

// Mock lib/storage
vi.mock('@/lib/storage', () => ({
  generateFileKey: vi
    .fn()
    .mockImplementation((ext: string, prefix = 'submissions') => `${prefix}/mock-uuid.${ext}`),
  generatePresignedUploadUrl: vi.fn().mockResolvedValue('https://r2.example.com/upload'),
}));

import { getSessionFromHeaders } from '@/server/auth';
import { getDb } from '@/db/index';
import { generateFileKey, generatePresignedUploadUrl } from '@/lib/storage';

describe('files.server.ts - getPresignedReviewFeedbackUploadUrlHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getDb).mockReturnValue({
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          then: (fn: (v: unknown[]) => unknown) => Promise.resolve([]).then(fn),
        }),
      }),
    } as any);
  });

  const instructorSession = {
    user: {
      id: 'instructor-1',
      name: 'Instructor',
      email: 'i@t.com',
      role: 'instructor',
      locale: 'en',
      emailVerified: true,
    },
    session: { id: 's-1', token: 't-1', expiresAt: new Date() },
  };

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
    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  });

  it('should return upload URL for instructor feedback', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue(instructorSession as any);

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

  it('should reject unsupported .exe extension', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    const { getPresignedReviewFeedbackUploadUrlHandler } = await import('@/server/files.server');
    const result = await getPresignedReviewFeedbackUploadUrlHandler({
      data: { extension: 'exe', contentType: 'application/x-msdownload' },
    });

    expect(result).toEqual({
      error: { code: 'BAD_REQUEST', message: 'Unsupported file extension' },
    });
    expect(generateFileKey).not.toHaveBeenCalled();
    expect(generatePresignedUploadUrl).not.toHaveBeenCalled();
  });

  it('should reject unsupported .svg extension', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    const { getPresignedReviewFeedbackUploadUrlHandler } = await import('@/server/files.server');
    const result = await getPresignedReviewFeedbackUploadUrlHandler({
      data: { extension: 'svg', contentType: 'image/svg+xml' },
    });

    expect(result).toEqual({
      error: { code: 'BAD_REQUEST', message: 'Unsupported file extension' },
    });
    expect(generateFileKey).not.toHaveBeenCalled();
    expect(generatePresignedUploadUrl).not.toHaveBeenCalled();
  });

  it('should reject mismatched content type for .docx feedback', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    const { getPresignedReviewFeedbackUploadUrlHandler } = await import('@/server/files.server');
    const result = await getPresignedReviewFeedbackUploadUrlHandler({
      data: { extension: 'docx', contentType: 'application/pdf' },
    });

    expect(result).toEqual({
      error: { code: 'BAD_REQUEST', message: 'Content type does not match file extension' },
    });
    expect(generateFileKey).not.toHaveBeenCalled();
    expect(generatePresignedUploadUrl).not.toHaveBeenCalled();
  });

  it('should accept .docx feedback with correct content type', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    const { getPresignedReviewFeedbackUploadUrlHandler } = await import('@/server/files.server');
    const result = await getPresignedReviewFeedbackUploadUrlHandler({
      data: {
        extension: 'docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    });

    expect(result).toEqual({
      uploadUrl: 'https://r2.example.com/upload',
      fileKey: 'feedback/mock-uuid.docx',
    });
    expect(generateFileKey).toHaveBeenCalledWith('docx', 'feedback');
  });
});
