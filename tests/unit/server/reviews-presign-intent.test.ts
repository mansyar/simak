/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/storage', () => ({
  generateFileKey: vi
    .fn()
    .mockImplementation((ext: string, prefix = 'submissions') => `${prefix}/mock-uuid.${ext}`),
  generatePresignedUploadUrl: vi.fn().mockResolvedValue('https://r2.example.com/upload-feedback'),
}));

import { getSessionFromHeaders } from '@/server/auth';
import { getDb } from '@/db/index';
import { generateFileKey, generatePresignedUploadUrl } from '@/lib/storage';
import { uploadIntents } from '@/db/schema/submissions';
import { getPresignedReviewFeedbackUploadUrlHandler } from '@/server/files.server';

function createMockDbForFeedback() {
  const insertValuesCall: { table: unknown; values: unknown }[] = [];

  const valuesStep: any = {
    then: (fn: (v: unknown[]) => unknown) => Promise.resolve([]).then(fn),
  };

  const insertFn = vi.fn((table: unknown) => {
    return {
      values: vi.fn((values: unknown) => {
        insertValuesCall.push({ table, values });
        return valuesStep;
      }),
    };
  });

  const mockDb = {
    insert: insertFn,
  };

  return { mockDb, insertValuesCall };
}

describe('getPresignedReviewFeedbackUploadUrlHandler - upload intent insertion', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts an upload_intents row with purpose review_feedback and null checkpointId', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    const { mockDb, insertValuesCall } = createMockDbForFeedback();
    vi.mocked(getDb).mockReturnValue(mockDb as any);

    const beforeCall = Date.now();
    const result = await getPresignedReviewFeedbackUploadUrlHandler({
      data: {
        extension: 'pdf',
        contentType: 'application/pdf',
      },
    });
    const afterCall = Date.now();

    expect(result).toEqual({
      uploadUrl: 'https://r2.example.com/upload-feedback',
      fileKey: 'feedback/mock-uuid.pdf',
    });
    expect(generateFileKey).toHaveBeenCalledWith('pdf', 'feedback');
    expect(generatePresignedUploadUrl).toHaveBeenCalledWith({
      key: 'feedback/mock-uuid.pdf',
      contentType: 'application/pdf',
    });

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    expect(insertValuesCall).toHaveLength(1);
    expect(insertValuesCall[0].table).toBe(uploadIntents);

    const intentValues = insertValuesCall[0].values as Record<string, unknown>;
    expect(intentValues.fileKey).toBe('feedback/mock-uuid.pdf');
    expect(intentValues.userId).toBe('instructor-1');
    expect(intentValues.purpose).toBe('review_feedback');
    expect(intentValues.checkpointId).toBeNull();
    expect(intentValues.contentType).toBe('application/pdf');
    expect(intentValues.fileName).toBeNull();
    expect(intentValues.fileSize).toBeNull();
    expect(intentValues.consumedAt).toBeNull();

    const expiresAt = intentValues.expiresAt as Date;
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(beforeCall + 14 * 60 * 1000);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(afterCall + 16 * 60 * 1000);
  });
});
