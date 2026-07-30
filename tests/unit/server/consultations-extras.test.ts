/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listVerifiedCountsHandler } from '@/server/consultations-extras.server';
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
    middleware: vi.fn().mockReturnThis(),
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
  createMiddleware: vi.fn().mockReturnValue({
    server: vi.fn().mockImplementation((fn) => fn),
  }),
}));

describe('listVerifiedCountsHandler', () => {
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
  });

  it('should fail if unauthorized', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
    const result = await listVerifiedCountsHandler({ data: { assignmentId: 1 } });
    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  });

  it('should return counts for student', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);

    mockDb.then
      // Enrollment check
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      // Mock checkpoint query (with studentId filter)
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ id: 1, name: 'Ch 1', order: 1, minConsultations: 2 }]).then(onfulfilled),
      )
      // Mock GROUP BY count query
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ checkpointId: 1, count: 1 }]).then(onfulfilled),
      );

    const result = (await listVerifiedCountsHandler({
      data: { assignmentId: 1 },
    })) as { counts: any[] };
    expect(result).toHaveProperty('counts');
    expect(result.counts).toHaveLength(1);
    expect(result.counts[0].verifiedCount).toBe(1);
  });

  it('should return counts for instructor', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);

    mockDb.then
      // Assignment ownership check
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      // Mock checkpoint query for instructor (all students)
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ id: 1, name: 'Ch 1', order: 1, minConsultations: 2 }]).then(onfulfilled),
      )
      // Mock GROUP BY count query
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ checkpointId: 1, count: 3 }]).then(onfulfilled),
      );

    const result = await listVerifiedCountsHandler({ data: { assignmentId: 1 } });
    expect(result).toHaveProperty('counts');
  });

  it('should reject if student is not enrolled for verified counts', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
    // Enrollment check returns empty
    mockDb.then.mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));
    const result = await listVerifiedCountsHandler({ data: { assignmentId: 999 } });
    expect(result).toEqual(serverError(ErrorCode.NOT_FOUND, 'Assignment not found'));
  });

  it('should reject if instructor does not own assignment for verified counts', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession);
    // Ownership check returns empty
    mockDb.then.mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));
    const result = await listVerifiedCountsHandler({ data: { assignmentId: 999 } });
    expect(result).toEqual(serverError(ErrorCode.NOT_FOUND, 'Assignment not found'));
  });

  it('should return correct counts for multiple checkpoints with single GROUP BY query (PERF-1)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);

    mockDb.then
      // Enrollment check
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([{ id: 1 }]).then(onfulfilled))
      // Mock checkpoint query — 3 checkpoints
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          { id: 1, name: 'Ch 1', order: 1, minConsultations: 2 },
          { id: 2, name: 'Ch 2', order: 2, minConsultations: 1 },
          { id: 3, name: 'Ch 3', order: 3, minConsultations: 0 },
        ]).then(onfulfilled),
      )
      // Mock single GROUP BY count query — returns counts for all checkpoints at once
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([
          { checkpointId: 1, count: 2 },
          { checkpointId: 2, count: 1 },
          // Checkpoint 3 has 0 verified consultations — no row in GROUP BY result
        ]).then(onfulfilled),
      );

    const result = (await listVerifiedCountsHandler({
      data: { assignmentId: 1 },
    })) as { counts: any[] };

    expect(result).toHaveProperty('counts');
    expect(result.counts).toHaveLength(3);
    expect(result.counts[0]).toEqual({
      checkpointId: 1,
      checkpointName: 'Ch 1',
      verifiedCount: 2,
      minConsultations: 2,
    });
    expect(result.counts[1]).toEqual({
      checkpointId: 2,
      checkpointName: 'Ch 2',
      verifiedCount: 1,
      minConsultations: 1,
    });
    expect(result.counts[2]).toEqual({
      checkpointId: 3,
      checkpointName: 'Ch 3',
      verifiedCount: 0,
      minConsultations: 0,
    });
    // Single GROUP BY query, not N per-checkpoint COUNTs
    expect(mockDb.then).toHaveBeenCalledTimes(3);
  });
});
