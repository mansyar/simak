/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { ListStudentAssignmentsSchema, StudentAssignmentIdParamSchema } from '@/server/assignments';
import {
  listStudentAssignmentsHandler,
  getStudentAssignmentDetailHandler,
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

describe('Student Assignment Server Functions - Schemas', () => {
  describe('ListStudentAssignmentsSchema', () => {
    it('should use defaults for empty input', () => {
      const result = ListStudentAssignmentsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
        expect(result.data.search).toBe('');
      }
    });

    it('should coerce string page to number', () => {
      const result = ListStudentAssignmentsSchema.safeParse({ page: '3' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(3);
      }
    });

    it('should reject page below 1', () => {
      const result = ListStudentAssignmentsSchema.safeParse({ page: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject limit above 100', () => {
      const result = ListStudentAssignmentsSchema.safeParse({ limit: 200 });
      expect(result.success).toBe(false);
    });

    it('should accept search string', () => {
      const result = ListStudentAssignmentsSchema.safeParse({ search: 'thesis' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.search).toBe('thesis');
      }
    });
  });

  describe('StudentAssignmentIdParamSchema', () => {
    it('should coerce string id to number', () => {
      const result = StudentAssignmentIdParamSchema.safeParse({ id: '42' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(42);
      }
    });

    it('should accept numeric id', () => {
      const result = StudentAssignmentIdParamSchema.safeParse({ id: 42 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(42);
      }
    });

    it('should reject non-numeric id', () => {
      const result = StudentAssignmentIdParamSchema.safeParse({ id: 'abc' });
      expect(result.success).toBe(false);
    });

    it('should reject negative id', () => {
      const result = StudentAssignmentIdParamSchema.safeParse({ id: -1 });
      expect(result.success).toBe(false);
    });
  });
});

describe('Student Assignment Server Functions - Logic & Security', () => {
  let mockDb: any;
  const studentSession = {
    user: { id: 'student-1', role: 'student' as const },
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
      leftJoin: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      then: vi.fn(function (onfulfilled: any) {
        return Promise.resolve([]).then(onfulfilled);
      }),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  describe('listStudentAssignmentsHandler', () => {
    it('should return empty list if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);

      const result = await listStudentAssignmentsHandler({
        data: { page: 1, limit: 20, search: '' },
      });
      expect(result).toEqual({ assignments: [], total: 0 });
    });

    it('should return only assignments assigned to the logged-in student', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 101,
              title: 'Thesis Assignment',
              description: 'Final thesis',
              finalDeadline: new Date('2026-06-01'),
              createdAt: new Date(),
              templateName: 'Thesis Template',
              templateType: 'Thesis',
            },
            {
              id: 102,
              title: 'Capstone Project',
              description: 'Capstone description',
              finalDeadline: new Date('2026-07-01'),
              createdAt: new Date(),
              templateName: 'Capstone Template',
              templateType: 'Capstone',
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 2 }]).then(onfulfilled),
        );

      const result = await listStudentAssignmentsHandler({
        data: { page: 1, limit: 20, search: '' },
      });

      expect(result.assignments).toHaveLength(2);
      expect(result.assignments[0].title).toBe('Thesis Assignment');
      expect(result.assignments[1].title).toBe('Capstone Project');
      expect(result.total).toBe(2);
    });

    it('should filter assignments by search title', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 101,
              title: 'Thesis Assignment',
              description: 'Final thesis',
              finalDeadline: new Date('2026-06-01'),
              createdAt: new Date(),
              templateName: 'Thesis Template',
              templateType: 'Thesis',
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 1 }]).then(onfulfilled),
        );

      const result = await listStudentAssignmentsHandler({
        data: { page: 1, limit: 20, search: 'thesis' },
      });

      expect(result.assignments).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should enforce pagination', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 0 }]).then(onfulfilled),
        );

      await listStudentAssignmentsHandler({
        data: { page: 2, limit: 10, search: '' },
      });

      expect(mockDb.limit).toHaveBeenCalledWith(10);
      expect(mockDb.offset).toHaveBeenCalledWith(10);
    });
  });

  describe('getStudentAssignmentDetailHandler', () => {
    it('should return null if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);

      const result = await getStudentAssignmentDetailHandler({ data: { id: 101 } });
      expect(result).toBeNull();
    });

    it('should return null if assignment is not assigned to the student', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );

      const result = await getStudentAssignmentDetailHandler({ data: { id: 999 } });
      expect(result).toBeNull();
    });

    it('should return assignment detail with checkpoints for own assignment', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession as any);

      mockDb.then
        // First query: assignment-student ownership check + assignment detail
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 101,
              title: 'Thesis Assignment',
              description: 'Final thesis',
              finalDeadline: new Date('2026-06-01'),
              createdAt: new Date(),
              instructorName: 'Dr. Smith',
              templateName: 'Thesis Template',
              templateType: 'Thesis',
            },
          ]).then(onfulfilled),
        )
        // Second query: checkpoints with consultation counts
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            {
              id: 1,
              name: 'Proposal',
              order: 1,
              state: 'passed',
              dueDate: new Date('2026-03-01'),
              minConsultations: 2,
              verifiedConsultationCount: 2,
            },
            {
              id: 2,
              name: 'Chapter 1',
              order: 2,
              state: 'unlocked',
              dueDate: new Date('2026-04-01'),
              minConsultations: 1,
              verifiedConsultationCount: 1,
            },
            {
              id: 3,
              name: 'Chapter 2',
              order: 3,
              state: 'locked',
              dueDate: new Date('2026-05-01'),
              minConsultations: 1,
              verifiedConsultationCount: 0,
            },
          ]).then(onfulfilled),
        );

      const result = await getStudentAssignmentDetailHandler({ data: { id: 101 } });

      expect(result).not.toBeNull();
      if (result) {
        expect(result.title).toBe('Thesis Assignment');
        expect(result.instructorName).toBe('Dr. Smith');
        expect(result.checkpoints).toHaveLength(3);
        expect(result.checkpoints[0].state).toBe('passed');
        expect(result.checkpoints[2].state).toBe('locked');
        expect(result.checkpoints[2].blockingReasons).toBeDefined();
        expect(result.checkpoints[2].blockingReasons!.length).toBe(2);
        expect(result.checkpoints[2].blockingReasons![0]).toContain(
          'Previous checkpoint not passed',
        );
        expect(result.checkpoints[2].blockingReasons![1]).toContain('Insufficient consultations');
        expect(result.progressPercent).toBe(33);
      }
    });
  });
});
