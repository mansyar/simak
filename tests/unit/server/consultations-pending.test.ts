/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listPendingConsultationsHandler } from '@/server/consultations.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import { serverError, ErrorCode } from '@/lib/errors';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

describe('listPendingConsultationsHandler', () => {
  let returningResult: any = null;

  const mockDb: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    for: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    then: vi.fn(function (onfulfilled: any) {
      return Promise.resolve([]).then(onfulfilled);
    }),
  };

  const studentSession = {
    user: { id: 'student-1', role: 'student' } as any,
    session: {} as any,
  };

  const instructorSession = {
    user: { id: 'instructor-1', role: 'instructor' } as any,
    session: {} as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
    returningResult = null;
    mockDb.returning.mockReturnValue({
      then: vi.fn(function (onfulfilled: any) {
        return Promise.resolve(returningResult).then(onfulfilled);
      }),
    });
  });

  it('should fail if unauthorized', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
    const result = await listPendingConsultationsHandler({
      data: { assignmentId: 1, page: 1, limit: 20 },
    });
    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  });

  it('should fail if student tries', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
    const result = await listPendingConsultationsHandler({
      data: { assignmentId: 1, page: 1, limit: 20 },
    });
    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  });

  it('should return pending consultations for instructor', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);

    mockDb.then
      // Assignment ownership check
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      // Data query
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          {
            id: 1,
            studentName: 'Student A',
            checkpointName: 'Ch 1',
            sessionType: 'internal',
            createdAt: new Date('2026-05-01T00:00:00.000Z'),
          },
        ]).then(onfulfilled),
      )
      // Count query
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 1 }]).then(onfulfilled),
      );

    const result = await listPendingConsultationsHandler({
      data: { assignmentId: 1, page: 1, limit: 20 },
    });
    expect(result).toHaveProperty('consultations');
    expect(result).toHaveProperty('total', 1);
  });

  it('should accept page/limit params and return total count (PERF-16)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 42 }]).then(onfulfilled),
      );

    const result = await listPendingConsultationsHandler({
      data: { assignmentId: 1, page: 2, limit: 10 },
    });

    expect(result).toHaveProperty('total', 42);
    expect(mockDb.limit).toHaveBeenCalledWith(10);
    expect(mockDb.offset).toHaveBeenCalledWith(10);
  });

  it('should default to page=1, limit=20 when not provided (PERF-16)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 0 }]).then(onfulfilled),
      );

    await listPendingConsultationsHandler({
      data: { assignmentId: 1, page: 1, limit: 20 },
    });

    expect(mockDb.limit).toHaveBeenCalledWith(20);
    expect(mockDb.offset).toHaveBeenCalledWith(0);
  });

  it('should return empty consultations when page is beyond range (PERF-16)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 5 }]).then(onfulfilled),
      );

    const result = (await listPendingConsultationsHandler({
      data: { assignmentId: 1, page: 100, limit: 20 },
    })) as { consultations: any[]; total: number };

    expect(result.consultations).toEqual([]);
    expect(result.total).toBe(5);
  });
});
