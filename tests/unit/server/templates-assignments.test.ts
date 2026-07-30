/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listTemplateAssignmentsHandler } from '@/server/templates.server';
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

describe('listTemplateAssignments', () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    then: vi.fn(function (onfulfilled: any) {
      return Promise.resolve([]).then(onfulfilled);
    }),
  };

  const adminSession = {
    user: { id: 'admin-1', role: 'admin' } as any,
    session: {} as any,
  };

  const studentSession = {
    user: { id: 'student-1', role: 'student' } as any,
    session: {} as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  it('should return assignments linked to template with student counts', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          { id: 1, title: 'Assignment 1', instructorName: 'Dr. Smith', createdAt: new Date() },
          { id: 2, title: 'Assignment 2', instructorName: 'Dr. Jones', createdAt: new Date() },
        ]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 2 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          { assignmentId: 1, count: 5 },
          { assignmentId: 2, count: 3 },
        ]).then(onfulfilled),
      );

    const result = (await listTemplateAssignmentsHandler({
      data: { templateId: 1, page: 1, limit: 20 },
    })) as { assignments: { studentCount: number }[]; total: number };

    expect(result.assignments).toHaveLength(2);
    expect(result.assignments[0]).toEqual({
      id: 1,
      title: 'Assignment 1',
      instructorName: 'Dr. Smith',
      studentCount: 5,
      createdAt: expect.any(Date),
    });
    expect(result.assignments[1].studentCount).toBe(3);
    expect(result.total).toBe(2);
  });

  it('should return empty assignments for non-admin', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);

    const result = await listTemplateAssignmentsHandler({
      data: { templateId: 1, page: 1, limit: 20 },
    });
    expect(result).toEqual({ assignments: [], total: 0 });
  });

  it('should return empty assignments for null session', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);

    const result = await listTemplateAssignmentsHandler({
      data: { templateId: 1, page: 1, limit: 20 },
    });
    expect(result).toEqual({ assignments: [], total: 0 });
  });

  it('should return empty array when no assignments exist', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 0 }]).then(onfulfilled),
      );

    const result = await listTemplateAssignmentsHandler({
      data: { templateId: 999, page: 1, limit: 20 },
    });
    expect(result).toEqual({ assignments: [], total: 0 });
  });

  it('should accept page/limit params and return total count (PERF-18)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          { id: 1, title: 'Assignment 1', instructorName: 'Dr. Smith', createdAt: new Date() },
        ]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 42 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ assignmentId: 1, count: 5 }]).then(onfulfilled),
      );

    const result = (await listTemplateAssignmentsHandler({
      data: { templateId: 1, page: 2, limit: 10 },
    })) as { assignments: unknown[]; total: number };

    expect(result.total).toBe(42);
    expect(mockDb.limit).toHaveBeenCalledWith(10);
    expect(mockDb.offset).toHaveBeenCalledWith(10);
  });

  it('should default to page=1, limit=20 when not provided (PERF-18)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 0 }]).then(onfulfilled),
      );

    await listTemplateAssignmentsHandler({ data: { templateId: 1 } } as any);

    expect(mockDb.limit).toHaveBeenCalledWith(20);
    expect(mockDb.offset).toHaveBeenCalledWith(0);
  });

  it('should return empty assignments when page is beyond range (PERF-18)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);

    mockDb.then
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 5 }]).then(onfulfilled),
      );

    const result = await listTemplateAssignmentsHandler({
      data: { templateId: 1, page: 100, limit: 20 },
    });
    expect(result).toEqual({ assignments: [], total: 5 });
  });
});
