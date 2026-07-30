/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listDiscussionMessagesHandler } from '@/server/discussions.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    middleware: vi.fn().mockReturnThis(),
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
  createMiddleware: vi.fn().mockReturnValue({
    server: vi.fn().mockImplementation((fn) => fn),
  }),
}));

describe('listDiscussionMessagesHandler', () => {
  let mockDb: any;

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
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      then: vi.fn(function (onfulfilled: any) {
        return Promise.resolve([]).then(onfulfilled);
      }),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  it('should reject if unauthorized', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);

    const result = await listDiscussionMessagesHandler({
      data: { checkpointId: 1, page: 1, limit: 20 },
    });
    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  });

  it('should reject non-student/instructor roles', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' as const },
      session: {} as any,
    } as any);

    const result = await listDiscussionMessagesHandler({
      data: { checkpointId: 1, page: 1, limit: 20 },
    });
    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  });

  it('should return empty messages for own checkpoint', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 0 }]).then(onfulfilled),
      );

    const result = await listDiscussionMessagesHandler({
      data: { checkpointId: 1, page: 1, limit: 20 },
    });
    expect(result).toEqual({ messages: [], total: 0 });
  });

  it('should return messages with author name and role via JOIN', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    const messages = [
      {
        id: 1,
        message: 'Hello',
        userId: 'student-1',
        authorName: 'Alice',
        authorRole: 'student',
        parentMessageId: null,
        createdAt: new Date('2026-07-25T10:00:00Z'),
        deletedAt: null,
      },
      {
        id: 2,
        message: 'Hi there',
        userId: 'instructor-1',
        authorName: 'Bob',
        authorRole: 'instructor',
        parentMessageId: null,
        createdAt: new Date('2026-07-25T11:00:00Z'),
        deletedAt: null,
      },
    ];

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve(messages).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 2 }]).then(onfulfilled),
      );

    const result = (await listDiscussionMessagesHandler({
      data: { checkpointId: 1, page: 1, limit: 20 },
    })) as any;
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].authorName).toBe('Alice');
    expect(result.messages[0].authorRole).toBe('student');
    expect(result.messages[1].authorName).toBe('Bob');
    expect(result.messages[1].authorRole).toBe('instructor');
  });

  it('should order messages by createdAt ASC', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 0 }]).then(onfulfilled),
      );

    await listDiscussionMessagesHandler({
      data: { checkpointId: 1, page: 1, limit: 20 },
    });
    expect(mockDb.orderBy).toHaveBeenCalled();
    expect(mockDb.innerJoin).toHaveBeenCalled();
  });

  it('should paginate with page and limit params', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 42 }]).then(onfulfilled),
      );

    const result = await listDiscussionMessagesHandler({
      data: { checkpointId: 1, page: 2, limit: 10 },
    });
    expect(result).toEqual({ messages: [], total: 42 });
    expect(mockDb.limit).toHaveBeenCalledWith(10);
    expect(mockDb.offset).toHaveBeenCalledWith(10);
  });

  it('should reject student accessing other student checkpoint', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: 'student-2', role: 'student' as const },
      session: {} as any,
    } as any);

    mockDb.then.mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    const result = await listDiscussionMessagesHandler({
      data: { checkpointId: 1, page: 1, limit: 20 },
    });
    expect(result).toEqual({
      error: { code: 'NOT_FOUND', message: 'Checkpoint not found' },
    });
  });

  it('should allow instructor to view discussions on their assignment checkpoints', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 0 }]).then(onfulfilled),
      );

    const result = await listDiscussionMessagesHandler({
      data: { checkpointId: 1, page: 1, limit: 20 },
    });
    expect(result).toEqual({ messages: [], total: 0 });
  });

  it('should include replies to soft-deleted parent messages', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    const messages = [
      {
        id: 2,
        message: 'Reply to deleted parent',
        userId: 'student-1',
        authorName: 'Alice',
        authorRole: 'student',
        parentMessageId: 1,
        createdAt: new Date('2026-07-25T12:00:00Z'),
        deletedAt: null,
      },
    ];

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve(messages).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 1 }]).then(onfulfilled),
      );

    const result = (await listDiscussionMessagesHandler({
      data: { checkpointId: 1, page: 1, limit: 20 },
    })) as any;
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].parentMessageId).toBe(1);
  });

  it('should return total count', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 42 }]).then(onfulfilled),
      );

    const result = (await listDiscussionMessagesHandler({
      data: { checkpointId: 1, page: 1, limit: 20 },
    })) as any;
    expect(result.total).toBe(42);
  });
});
