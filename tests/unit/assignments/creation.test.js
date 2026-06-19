/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createAssignmentHandler,
  listInstructorAssignmentsHandler,
  getAssignmentDetailHandler,
} from '@/server/assignments.server';
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
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));
describe('Assignment Server Functions', () => {
  let mockDb;
  const mockSession = {
    user: { id: 'instructor-1', role: 'instructor' },
    session: {},
  };
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      transaction: vi.fn(async (cb) => cb(mockDb)),
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
      then: vi.fn(function (onfulfilled) {
        return Promise.resolve([]).then(onfulfilled);
      }),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb);
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
      expect(result).toEqual({ error: 'Unauthorized' });
    });
    it('should fail if user is not an instructor', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'student-1', role: 'student' },
        session: {},
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
      expect(result).toEqual({ error: 'Unauthorized' });
    });
    it('should succeed and instantiate checkpoints for students', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession);
      // Mock returning inserted assignment ID = 42
      mockDb.returning.mockImplementation(() => {
        return {
          then: (onfulfilled) => Promise.resolve([{ id: 42 }]).then(onfulfilled),
        };
      });
      // Mock select template checkpoints
      mockDb.then.mockImplementationOnce((onfulfilled) => {
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
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession);
      mockDb.then
        .mockImplementationOnce((onfulfilled) =>
          Promise.resolve([
            { id: 42, title: 'Assignment 1', templateName: 'Tpl', templateType: 'Thesis' },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled) =>
          Promise.resolve([{ assignmentId: 42, count: 5 }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled) => Promise.resolve([{ count: 1 }]).then(onfulfilled));
      const result = await listInstructorAssignmentsHandler({
        data: { page: 1, limit: 20, search: '' },
      });
      expect(result.assignments).toHaveLength(1);
      expect(result.assignments[0].studentCount).toBe(5);
      expect(result.total).toBe(1);
    });
  });
  describe('getAssignmentDetailHandler', () => {
    it('should return null if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await getAssignmentDetailHandler({ data: { id: 42 } });
      expect(result).toBeNull();
    });
    it('should return null if assignment not found or belongs to another instructor', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession);
      mockDb.then.mockImplementationOnce((onfulfilled) => Promise.resolve([]).then(onfulfilled));
      const result = await getAssignmentDetailHandler({ data: { id: 42 } });
      expect(result).toBeNull();
    });
    it('should return assignment details with student progress', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession);
      mockDb.then
        .mockImplementationOnce((onfulfilled) =>
          Promise.resolve([
            {
              id: 42,
              title: 'Detailed Assignment',
              instructorId: 'instructor-1',
              templateName: 'Thesis Template',
              templateType: 'Thesis',
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled) =>
          Promise.resolve([{ id: 'student-1', name: 'Alice', email: 'alice@test.com' }]).then(
            onfulfilled,
          ),
        )
        .mockImplementationOnce((onfulfilled) =>
          Promise.resolve([
            { id: 101, studentId: 'student-1', name: 'Milestone 1', order: 1, state: 'passed' },
            { id: 102, studentId: 'student-1', name: 'Milestone 2', order: 2, state: 'unlocked' },
          ]).then(onfulfilled),
        );
      const result = await getAssignmentDetailHandler({ data: { id: 42 } });
      expect(result).not.toBeNull();
      if (result) {
        expect(result.title).toBe('Detailed Assignment');
        expect(result.students).toHaveLength(1);
        expect(result.students[0].passedCount).toBe(1);
        expect(result.students[0].progressPercent).toBe(50);
        expect(result.students[0].activeCheckpoint).not.toBeNull();
        expect(result.students[0].activeCheckpoint.name).toBe('Milestone 2');
        expect(result.students[0].activeCheckpoint.state).toBe('unlocked');
      }
    });
  });
});
