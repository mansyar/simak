/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateAssignmentSchema } from '@/server/assignments';
import {
  createAssignmentHandler,
  listInstructorAssignmentsHandler,
  getAssignmentDetailHandler,
} from '@/server/assignments.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import { isServerError } from '@/lib/errors';

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

describe('Assignment Server Functions', () => {
  let mockDb: any;
  const mockSession = {
    user: { id: 'instructor-1', role: 'instructor' as const },
    session: {} as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      transaction: vi.fn(async (cb: any) => cb(mockDb)),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      then: vi.fn(function (onfulfilled: any) {
        return Promise.resolve([]).then(onfulfilled);
      }),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  describe('createAssignmentHandler', () => {
    it('should fail if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await createAssignmentHandler({
        data: {
          templateId: 1,
          title: 'New Assignment',
          description: 'Description',
          finalDeadline: new Date(Date.now() + 86400000),
          studentIds: ['student-1'],
        },
      });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should fail if user is not an instructor', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'student-1', role: 'student' } as any,
        session: {} as any,
      });
      const result = await createAssignmentHandler({
        data: {
          templateId: 1,
          title: 'New Assignment',
          description: 'Description',
          finalDeadline: new Date(Date.now() + 86400000),
          studentIds: ['student-1'],
        },
      });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should succeed and instantiate checkpoints for students', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as any);

      // Mock validation query: all studentIds are valid active students
      mockDb.then.mockImplementationOnce((onfulfilled: any) => {
        return Promise.resolve([{ id: 'student-1' }, { id: 'student-2' }]).then(onfulfilled);
      });

      // Mock returning inserted assignment ID = 42
      mockDb.returning.mockImplementation(() => {
        return {
          then: (onfulfilled: any) => Promise.resolve([{ id: 42 }]).then(onfulfilled),
        };
      });

      // Mock select template checkpoints
      mockDb.then.mockImplementationOnce((onfulfilled: any) => {
        return Promise.resolve([
          { name: 'Milestone 1', order: 1 },
          { name: 'Milestone 2', order: 2 },
        ]).then(onfulfilled);
      });

      const result = await createAssignmentHandler({
        data: {
          templateId: 1,
          title: 'New Assignment',
          description: 'Description',
          finalDeadline: new Date(Date.now() + 86400000),
          studentIds: ['student-1', 'student-2'],
        },
      });

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('assignmentId', 42);
      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('AC-13: rejects studentIds containing an admin userId', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as any);

      // Validation query returns only 1 valid student (admin userId is not a student)
      mockDb.then.mockImplementationOnce((onfulfilled: any) => {
        return Promise.resolve([{ id: 'student-1' }]).then(onfulfilled);
      });

      const result = await createAssignmentHandler({
        data: {
          templateId: 1,
          title: 'New Assignment',
          description: 'Description',
          finalDeadline: new Date(Date.now() + 86400000),
          studentIds: ['student-1', 'admin-1'],
        },
      });

      expect(result).toEqual({
        error: {
          code: 'BAD_REQUEST',
          message: 'One or more selected users are not active students',
        },
      });
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('AC-14: rejects studentIds containing a deleted student userId', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as any);

      // Validation query returns only 1 valid student (deleted student filtered out)
      mockDb.then.mockImplementationOnce((onfulfilled: any) => {
        return Promise.resolve([{ id: 'student-1' }]).then(onfulfilled);
      });

      const result = await createAssignmentHandler({
        data: {
          templateId: 1,
          title: 'New Assignment',
          description: 'Description',
          finalDeadline: new Date(Date.now() + 86400000),
          studentIds: ['student-1', 'deleted-student-2'],
        },
      });

      expect(result).toEqual({
        error: {
          code: 'BAD_REQUEST',
          message: 'One or more selected users are not active students',
        },
      });
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('rejects studentIds containing an instructor userId', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as any);

      // Validation query returns only 1 valid student (instructor filtered out)
      mockDb.then.mockImplementationOnce((onfulfilled: any) => {
        return Promise.resolve([{ id: 'student-1' }]).then(onfulfilled);
      });

      const result = await createAssignmentHandler({
        data: {
          templateId: 1,
          title: 'New Assignment',
          description: 'Description',
          finalDeadline: new Date(Date.now() + 86400000),
          studentIds: ['student-1', 'instructor-2'],
        },
      });

      expect(result).toEqual({
        error: {
          code: 'BAD_REQUEST',
          message: 'One or more selected users are not active students',
        },
      });
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });
  });

  describe('listInstructorAssignmentsHandler', () => {
    it('should fail if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await listInstructorAssignmentsHandler({
        data: { page: 1, limit: 20, search: '' },
      });
      expect(result).toEqual({ assignments: [], total: 0 });
    });

    it('should return list of instructor assignments and total count', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as any);

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 42,
              title: 'Assignment 1',
              templateName: 'Tpl',
              templateType: 'Thesis',
              finalDeadline: new Date('2026-12-31T00:00:00.000Z'),
              createdAt: new Date('2026-05-01T00:00:00.000Z'),
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 1 }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ assignmentId: 42, count: 5 }]).then(onfulfilled),
        );

      const result = await listInstructorAssignmentsHandler({
        data: { page: 1, limit: 20, search: '' },
      });
      if (isServerError(result)) throw new Error(result.error.message);

      expect(result.assignments).toHaveLength(1);
      expect(result.assignments[0].studentCount).toBe(5);
      expect(result.total).toBe(1);
    });

    it('should run data and count queries in parallel via Promise.all (PERF-26)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as any);

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 42,
              title: 'Assignment 1',
              templateName: 'Tpl',
              templateType: 'Thesis',
              finalDeadline: new Date('2026-12-31T00:00:00.000Z'),
              createdAt: new Date('2026-05-01T00:00:00.000Z'),
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 1 }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ assignmentId: 42, count: 3 }]).then(onfulfilled),
        );

      const result = await listInstructorAssignmentsHandler({
        data: { page: 1, limit: 20, search: '' },
      });
      if (isServerError(result)) throw new Error(result.error.message);

      // With Promise.all, count query (2nd call) runs before student counts (3rd call)
      expect(mockDb.then).toHaveBeenCalledTimes(3);
      expect(result.total).toBe(1);
      expect(result.assignments[0].studentCount).toBe(3);
    });
  });

  describe('getAssignmentDetailHandler', () => {
    it('should return null if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await getAssignmentDetailHandler({ data: { id: 42 } });
      expect(result).toBeNull();
    });

    it('should return null if assignment not found or belongs to another instructor', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as any);
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );

      const result = await getAssignmentDetailHandler({ data: { id: 42 } });
      expect(result).toBeNull();
    });

    it('should return assignment details with student progress', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as any);

      const dueDate1 = new Date('2026-06-01T00:00:00.000Z');
      const dueDate2 = new Date('2026-07-01T00:00:00.000Z');

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 42,
              title: 'Detailed Assignment',
              instructorId: 'instructor-1',
              templateName: 'Thesis Template',
              templateType: 'Thesis',
              finalDeadline: new Date('2026-12-31T00:00:00.000Z'),
              createdAt: new Date('2026-05-01T00:00:00.000Z'),
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 'student-1', name: 'Alice', email: 'alice@test.com' }]).then(
            onfulfilled,
          ),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 101,
              studentId: 'student-1',
              name: 'Milestone 1',
              order: 1,
              state: 'passed',
              dueDate: dueDate1,
              minConsultations: 0,
            },
            {
              id: 102,
              studentId: 'student-1',
              name: 'Milestone 2',
              order: 2,
              state: 'unlocked',
              dueDate: dueDate2,
              minConsultations: 0,
            },
          ]).then(onfulfilled),
        );

      const result = await getAssignmentDetailHandler({ data: { id: 42 } });

      expect(result).not.toBeNull();
      if (!result || isServerError(result)) throw new Error('unexpected server error');
      {
        expect(result.title).toBe('Detailed Assignment');
        expect(result.students).toHaveLength(1);
        expect(result.students[0].passedCount).toBe(1);
        expect(result.students[0].progressPercent).toBe(50);
        expect(result.students[0].activeCheckpoint).not.toBeNull();
        expect(result.students[0].activeCheckpoint!.name).toBe('Milestone 2');
        expect(result.students[0].activeCheckpoint!.state).toBe('unlocked');
        expect(result.students[0].effectiveDeadline).toBe(dueDate2.toISOString());
      }
    });
  });
});
