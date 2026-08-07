/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { serverError, ErrorCode } from '@/lib/errors';
import * as auth from '@/server/auth';
import * as audit from '@/lib/audit';
import { reassignAssignmentHandler } from '@/server/assignments-admin.server';

vi.mock('@/server/auth', () => ({ getSessionFromHeaders: vi.fn() }));
vi.mock('@/db/index', () => ({ getDb: vi.fn() }));
vi.mock('@/lib/audit', () => ({ logAuditEvent: vi.fn() }));
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

const adminSession = { user: { id: 'admin-1', role: 'admin' } };
const instructorSession = { user: { id: 'instructor-1', role: 'instructor' } };

function createMockDb() {
  const mockDb: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    for: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    transaction: vi.fn(async (callback: any) => callback(mockDb)),
    then: vi.fn(function (this: any, onfulfilled: any) {
      return Promise.resolve([]).then(onfulfilled);
    }),
  };
  return mockDb;
}

describe('reassignAssignmentHandler', () => {
  let mockDb: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    const { getDb } = await import('@/db/index');
    vi.mocked(getDb).mockReturnValue(mockDb);
  });

  it('should fail if unauthorized (non-admin)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
    const result = await reassignAssignmentHandler({
      data: { assignmentId: 1, newInstructorId: 'instructor-2' },
    });
    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  });

  it('should fail if assignment not found or deleted', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
    mockDb.then.mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    const result = await reassignAssignmentHandler({
      data: { assignmentId: 999, newInstructorId: 'instructor-2' },
    });
    expect(result).toEqual({ error: { code: 'NOT_FOUND', message: 'Assignment not found' } });
  });

  it('should fail if replacement instructor not found or not active', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
    mockDb.then
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ id: 1, instructorId: 'instructor-1', deletedAt: null }]).then(
          onfulfilled,
        ),
      )
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    const result = await reassignAssignmentHandler({
      data: { assignmentId: 1, newInstructorId: 'nonexistent' },
    });
    expect(result).toEqual({
      error: {
        code: 'BAD_REQUEST',
        message: 'Replacement instructor not found or not an active instructor',
      },
    });
  });

  it('should reassign assignment and transition under_review checkpoints within a transaction with FOR UPDATE', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
    mockDb.then
      // Assignment SELECT (inside transaction, with FOR UPDATE)
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ id: 1, instructorId: 'instructor-1', deletedAt: null }]).then(
          onfulfilled,
        ),
      )
      // Instructor SELECT (inside transaction, with FOR UPDATE)
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ id: 'instructor-2', role: 'instructor', deletedAt: null }]).then(
          onfulfilled,
        ),
      )
      // Assignment UPDATE result
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      // Checkpoints UPDATE result
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    const result = await reassignAssignmentHandler({
      data: { assignmentId: 1, newInstructorId: 'instructor-2' },
    });
    expect(result).toEqual({ success: true });

    expect(mockDb.transaction).toHaveBeenCalled();
    expect(mockDb.for).toHaveBeenCalledWith(
      'update',
      expect.objectContaining({ of: expect.anything() }),
    );
    expect(mockDb.update).toHaveBeenCalledWith(expect.anything());
  });

  it('should preserve success when advisory audit logging fails', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
    mockDb.then
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ id: 1, deletedAt: null }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ id: 'instructor-2', role: 'instructor', deletedAt: null }]).then(
          onfulfilled,
        ),
      )
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));
    vi.mocked(audit.logAuditEvent).mockRejectedValueOnce(new Error('audit unavailable'));

    await expect(
      reassignAssignmentHandler({
        data: { assignmentId: 1, newInstructorId: 'instructor-2' },
      }),
    ).resolves.toEqual({ success: true });
  });

  it('should map transaction failures to an internal error', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);
    mockDb.transaction.mockRejectedValueOnce(new Error('database unavailable'));

    const result = await reassignAssignmentHandler({
      data: { assignmentId: 1, newInstructorId: 'instructor-2' },
    });

    expect(result).toEqual({
      error: { code: ErrorCode.INTERNAL, message: 'Internal Server Error' },
    });
  });
});
