/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { postDiscussionMessageHandler } from '@/server/discussions.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import { maybeInsertNotification } from '@/lib/notification-prefs';
import { enqueueEventEmail } from '@/lib/event-email';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/notification-prefs', () => ({
  maybeInsertNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/event-email', () => ({
  enqueueEventEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

describe('postDiscussionMessageHandler', () => {
  let mockDb: any;
  let mockTx: any;

  const studentSession = {
    user: { id: 'student-1', role: 'student' as const },
    session: {} as any,
  };
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
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      then: vi.fn((onfulfilled: any) => Promise.resolve([]).then(onfulfilled)),
    };

    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      transaction: vi.fn((cb: (tx: any) => Promise<any>) => cb(mockTx)),
      then: vi.fn((onfulfilled: any) => Promise.resolve([]).then(onfulfilled)),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  it('should reject if unauthorized', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);

    const result = await postDiscussionMessageHandler({
      data: { checkpointId: 1, message: 'Hello' },
    });
    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  });

  it('should reject non-student/instructor roles', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' as const },
      session: {} as any,
    } as any);

    const result = await postDiscussionMessageHandler({
      data: { checkpointId: 1, message: 'Hello' },
    });
    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  });

  it('should reject student accessing other student checkpoint', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: 'student-2', role: 'student' as const },
      session: {} as any,
    } as any);

    // verifyCheckpointAccess returns error (empty result = no access)
    mockDb.then.mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    const result = await postDiscussionMessageHandler({
      data: { checkpointId: 1, message: 'Hello' },
    });
    expect(result).toEqual({
      error: { code: 'NOT_FOUND', message: 'Checkpoint not found' },
    });
  });

  it('should insert message and return success when student posts', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    // [0] verifyCheckpointAccess — returns checkpoint row (access granted)
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ id: 1 }]).then(onfulfilled),
    );
    // [1] query checkpoint (assignmentId, studentId)
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ assignmentId: 10, studentId: 'student-1' }]).then(onfulfilled),
    );
    // [2] query assignment (instructorId)
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ instructorId: 'instructor-1' }]).then(onfulfilled),
    );
    // [3] transaction — insert returning
    mockTx.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ id: 42, message: 'Hello' }]).then(onfulfilled),
    );

    const result = (await postDiscussionMessageHandler({
      data: { checkpointId: 1, message: 'Hello' },
    })) as any;

    expect(result.success).toBe(true);
    expect(mockTx.insert).toHaveBeenCalled();
  });

  it('should insert message and return success when instructor posts', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    // [0] verifyCheckpointAccess — granted
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ id: 1 }]).then(onfulfilled),
    );
    // [1] query checkpoint (assignmentId, studentId)
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ assignmentId: 10, studentId: 'student-1' }]).then(onfulfilled),
    );
    // [2] query assignment (instructorId)
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ instructorId: 'instructor-1' }]).then(onfulfilled),
    );
    // [3] transaction — insert returning
    mockTx.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ id: 99, message: 'Reply from instructor' }]).then(onfulfilled),
    );

    const result = (await postDiscussionMessageHandler({
      data: { checkpointId: 1, message: 'Reply from instructor' },
    })) as any;

    expect(result.success).toBe(true);
    expect(mockTx.insert).toHaveBeenCalled();
  });

  it('should fire discussion_reply notification to instructor when student posts', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    // [0] verifyCheckpointAccess — granted
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ id: 1 }]).then(onfulfilled),
    );
    // [1] query checkpoint (assignmentId, studentId)
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ assignmentId: 10, studentId: 'student-1' }]).then(onfulfilled),
    );
    // [2] query assignment (instructorId)
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ instructorId: 'instructor-1' }]).then(onfulfilled),
    );
    // [3] transaction — insert returning
    mockTx.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ id: 42, message: 'Hello' }]).then(onfulfilled),
    );

    await postDiscussionMessageHandler({
      data: { checkpointId: 1, message: 'Hello' },
    });

    expect(maybeInsertNotification).toHaveBeenCalledWith(
      mockTx,
      'instructor-1',
      'discussion_reply',
      expect.objectContaining({
        metadata: expect.objectContaining({ target: 'instructor' }),
      }),
    );
  });

  it('should fire discussion_reply notification to student when instructor posts', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    // [0] verifyCheckpointAccess — granted
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ id: 1 }]).then(onfulfilled),
    );
    // [1] query checkpoint (assignmentId, studentId)
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ assignmentId: 10, studentId: 'student-1' }]).then(onfulfilled),
    );
    // [2] query assignment (instructorId)
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ instructorId: 'instructor-1' }]).then(onfulfilled),
    );
    // [3] transaction — insert returning
    mockTx.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ id: 99, message: 'Reply' }]).then(onfulfilled),
    );

    await postDiscussionMessageHandler({
      data: { checkpointId: 1, message: 'Reply' },
    });

    expect(maybeInsertNotification).toHaveBeenCalledWith(
      mockTx,
      'student-1',
      'discussion_reply',
      expect.objectContaining({
        metadata: expect.objectContaining({ target: 'student' }),
      }),
    );
  });

  it('should validate parentMessageId belongs to same checkpoint', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    // [0] verifyCheckpointAccess — granted
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ id: 1 }]).then(onfulfilled),
    );
    // [1] query checkpoint (assignmentId, studentId)
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ assignmentId: 10, studentId: 'student-1' }]).then(onfulfilled),
    );
    // [2] parentMessageId validation — returns empty (parent not found in this checkpoint)
    mockDb.then.mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    const result = await postDiscussionMessageHandler({
      data: { checkpointId: 1, message: 'Reply', parentMessageId: 999 },
    });

    expect(result).toEqual({
      error: { code: 'NOT_FOUND', message: 'Parent message not found' },
    });
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('should skip notification when self-replying', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    // [0] verifyCheckpointAccess — granted
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ id: 1 }]).then(onfulfilled),
    );
    // [1] query checkpoint — studentId is student-1 (same as poster)
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ assignmentId: 10, studentId: 'student-1' }]).then(onfulfilled),
    );
    // [2] query assignment — instructorId is student-1 (same as poster, edge case)
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ instructorId: 'student-1' }]).then(onfulfilled),
    );
    // [3] transaction — insert returning
    mockTx.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ id: 42, message: 'Note to self' }]).then(onfulfilled),
    );

    await postDiscussionMessageHandler({
      data: { checkpointId: 1, message: 'Note to self' },
    });

    expect(maybeInsertNotification).not.toHaveBeenCalled();
    expect(enqueueEventEmail).not.toHaveBeenCalled();
  });

  it('should call enqueueEventEmail post-commit', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    // [0] verifyCheckpointAccess — granted
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ id: 1 }]).then(onfulfilled),
    );
    // [1] query checkpoint
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ assignmentId: 10, studentId: 'student-1' }]).then(onfulfilled),
    );
    // [2] query assignment
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ instructorId: 'instructor-1' }]).then(onfulfilled),
    );
    // [3] transaction — insert returning
    mockTx.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ id: 42, message: 'Hello' }]).then(onfulfilled),
    );

    await postDiscussionMessageHandler({
      data: { checkpointId: 1, message: 'Hello' },
    });

    expect(enqueueEventEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: 'instructor-1',
        templateType: 'discussion_reply',
      }),
    );
  });
});
