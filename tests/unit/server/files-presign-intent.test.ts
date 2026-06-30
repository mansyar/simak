/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eq, and } from 'drizzle-orm';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

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

vi.mock('@/lib/storage', () => ({
  generateFileKey: vi
    .fn()
    .mockImplementation((ext: string, prefix = 'submissions') => `${prefix}/mock-uuid.${ext}`),
  generatePresignedUploadUrl: vi.fn().mockResolvedValue('https://r2.example.com/upload'),
}));

import { getSessionFromHeaders } from '@/server/auth';
import { getDb } from '@/db/index';
import { generateFileKey, generatePresignedUploadUrl } from '@/lib/storage';
import { uploadIntents } from '@/db/schema/submissions';
import { getPresignedUploadUrlHandler } from '@/server/files.server';

function createMockDb(checkpointRows: unknown[]) {
  const insertValuesCall: { table: unknown; values: unknown }[] = [];

  const limitStep: any = {
    then: (fn: (v: unknown[]) => unknown) => Promise.resolve(checkpointRows).then(fn),
  };
  const whereStep: any = {
    limit: vi.fn().mockReturnValue(limitStep),
    then: (fn: (v: unknown[]) => unknown) => Promise.resolve(checkpointRows).then(fn),
  };
  const innerJoinStep: any = {
    where: vi.fn().mockReturnValue(whereStep),
    then: (fn: (v: unknown[]) => unknown) => Promise.resolve(checkpointRows).then(fn),
  };
  const fromStep: any = {
    innerJoin: vi.fn().mockReturnValue(innerJoinStep),
    where: vi.fn().mockReturnValue(whereStep),
    then: (fn: (v: unknown[]) => unknown) => Promise.resolve(checkpointRows).then(fn),
  };

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
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue(fromStep),
    }),
    insert: insertFn,
    eq,
    and,
  };

  return { mockDb, insertValuesCall };
}

describe('getPresignedUploadUrlHandler - upload intent insertion', () => {
  const studentSession = {
    user: {
      id: 'student-1',
      name: 'Student',
      email: 's@t.com',
      role: 'student',
      locale: 'en',
      emailVerified: true,
    },
    session: { id: 's-1', token: 't-1', expiresAt: new Date() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts an upload_intents row bound to the session user and checkpoint', async () => {
    vi.mocked(getSessionFromHeaders).mockResolvedValue(studentSession as any);

    const { mockDb, insertValuesCall } = createMockDb([{ id: 1, state: 'unlocked' }]);
    vi.mocked(getDb).mockReturnValue(mockDb as any);

    const beforeCall = Date.now();
    const result = await getPresignedUploadUrlHandler({
      data: {
        checkpointId: 1,
        contentType: 'application/pdf',
        extension: 'pdf',
      },
    });
    const afterCall = Date.now();

    expect(result).toEqual({
      uploadUrl: 'https://r2.example.com/upload',
      fileKey: 'submissions/mock-uuid.pdf',
    });
    expect(generateFileKey).toHaveBeenCalledWith('pdf');
    expect(generatePresignedUploadUrl).toHaveBeenCalledWith({
      key: 'submissions/mock-uuid.pdf',
      contentType: 'application/pdf',
    });

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    expect(insertValuesCall).toHaveLength(1);
    expect(insertValuesCall[0].table).toBe(uploadIntents);

    const intentValues = insertValuesCall[0].values as Record<string, unknown>;
    expect(intentValues.fileKey).toBe('submissions/mock-uuid.pdf');
    expect(intentValues.userId).toBe('student-1');
    expect(intentValues.purpose).toBe('submission');
    expect(intentValues.checkpointId).toBe(1);
    expect(intentValues.fileName).toBeNull();
    expect(intentValues.fileSize).toBeNull();
    expect(intentValues.contentType).toBe('application/pdf');
    expect(intentValues.consumedAt).toBeNull();

    const expiresAt = intentValues.expiresAt as Date;
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(beforeCall + 14 * 60 * 1000);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(afterCall + 16 * 60 * 1000);
  });
});
