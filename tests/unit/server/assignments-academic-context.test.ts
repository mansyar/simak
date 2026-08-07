/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateAssignmentSchema, ListInstructorAssignmentsSchema } from '@/server/assignments';
import * as assignmentHandlers from '@/server/assignments.server';
import { createAssignmentHandler } from '@/server/assignments.server';
import {
  getAssignmentDetailHandler,
  listInstructorAssignmentsHandler,
} from '@/server/assignments-context-handlers.server';
import {
  getActiveSectionStudentIds,
  getAssignmentContext,
  getAuthorizedInstructorSection,
  toAssignmentContextProjection,
} from '@/server/assignments-context.server';
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

describe('assignment academic-context contracts', () => {
  it('requires a section and defaults new assignments to individual draft mode', () => {
    const result = CreateAssignmentSchema.safeParse({
      templateId: 1,
      sectionId: 12,
      title: 'Contextual Assignment',
      finalDeadline: new Date(Date.now() + 86_400_000),
      studentIds: ['student-1'],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const data = result.data as any;
      expect(data.sectionId).toBe(12);
      expect(data.mode).toBe('individual');
      expect(data.status).toBe('draft');
    }
  });

  it('accepts authorized context filters and lifecycle status in instructor list input', () => {
    const result = ListInstructorAssignmentsSchema.safeParse({
      sectionId: 12,
      status: 'archived',
      page: 2,
      limit: 10,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const data = result.data as any;
      expect(data.sectionId).toBe(12);
      expect(data.status).toBe('archived');
    }
  });

  describe('handler authorization and projections', () => {
    let mockDb: any;
    const instructorSession = {
      user: { id: 'instructor-1', role: 'instructor' as const },
      session: {} as any,
    };

    beforeEach(() => {
      vi.clearAllMocks();
      mockDb = {
        transaction: vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback(mockDb)),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        for: vi.fn().mockReturnThis(),
        then: vi.fn((onfulfilled: (value: unknown) => unknown) =>
          Promise.resolve([]).then(onfulfilled),
        ),
      };
      vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
    });

    it('rejects an instructor who is not actively enrolled in the selected section', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockDb.then.mockImplementationOnce((onfulfilled: (value: unknown) => unknown) =>
        Promise.resolve([]).then(onfulfilled),
      );

      const result = await createAssignmentHandler({
        data: {
          templateId: 1,
          sectionId: 12,
          title: 'Contextual Assignment',
          description: '',
          finalDeadline: new Date(Date.now() + 86_400_000),
          studentIds: ['student-1'],
          mode: 'individual',
          status: 'draft',
        },
      });

      expect(result).toEqual({
        error: { code: 'FORBIDDEN', message: 'Instructor is not authorized for this section' },
      });
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('persists the selected section and lifecycle defaults in the assignment projection', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockDb.then
        .mockImplementationOnce((onfulfilled: (value: unknown) => unknown) =>
          Promise.resolve([{ id: 12, status: 'active', instructorAuthorized: true }]).then(
            onfulfilled,
          ),
        )
        .mockImplementationOnce((onfulfilled: (value: unknown) => unknown) =>
          Promise.resolve([{ id: 'student-1' }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: (value: unknown) => unknown) =>
          Promise.resolve([{ id: 77 }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: (value: unknown) => unknown) =>
          Promise.resolve([]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: (value: unknown) => unknown) =>
          Promise.resolve([]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: (value: unknown) => unknown) =>
          Promise.resolve([{ createdAt: new Date() }]).then(onfulfilled),
        );

      const result = await createAssignmentHandler({
        data: {
          templateId: 1,
          sectionId: 12,
          title: 'Contextual Assignment',
          description: '',
          finalDeadline: new Date(Date.now() + 86_400_000),
          studentIds: ['student-1'],
          mode: 'individual',
          status: 'draft',
        },
      });

      expect(result).toMatchObject({ success: true, assignmentId: 77 });
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({ sectionId: 12, mode: 'individual', status: 'draft' }),
      );
    });

    it('returns lifecycle and academic context projections from instructor lists', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockDb.then
        .mockImplementationOnce((onfulfilled: (value: unknown) => unknown) =>
          Promise.resolve([
            {
              id: 77,
              title: 'Contextual Assignment',
              description: null,
              finalDeadline: new Date('2027-01-01T00:00:00.000Z'),
              createdAt: new Date('2026-08-01T00:00:00.000Z'),
              templateName: 'Template',
              templateType: 'Thesis',
              sectionId: 12,
              mode: 'individual',
              status: 'draft',
              termId: 3,
              termCode: '2026-FALL',
              termName: 'Fall 2026',
              courseId: 4,
              courseCode: 'CS101',
              courseName: 'Computer Science',
              sectionCode: 'A',
              sectionName: 'Section A',
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: (value: unknown) => unknown) =>
          Promise.resolve([{ count: 1 }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: (value: unknown) => unknown) =>
          Promise.resolve([{ assignmentId: 77, count: 1 }]).then(onfulfilled),
        );

      const result = await listInstructorAssignmentsHandler({
        data: { page: 1, limit: 20, search: '', sectionId: 12, status: 'draft' } as any,
      });

      expect(isServerError(result)).toBe(false);
      expect(result).toMatchObject({
        assignments: [
          {
            sectionId: 12,
            mode: 'individual',
            status: 'draft',
            context: {
              term: { id: 3, code: '2026-FALL', name: 'Fall 2026' },
              course: { id: 4, code: 'CS101', name: 'Computer Science' },
              section: { id: 12, code: 'A', name: 'Section A' },
            },
          },
        ],
      });
    });

    it('returns an empty list for an unauthenticated instructor query', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null as any);

      const result = await listInstructorAssignmentsHandler({
        data: { page: 1, limit: 20, search: '' } as any,
      });

      expect(result).toEqual({ assignments: [], total: 0 });
      expect(dbMod.getDb).not.toHaveBeenCalled();
    });

    it('handles empty instructor results and all optional filters', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockDb.then
        .mockImplementationOnce((onfulfilled: (value: unknown) => unknown) =>
          Promise.resolve([]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: (value: unknown) => unknown) =>
          Promise.resolve([{ count: 0 }]).then(onfulfilled),
        );

      const result = await listInstructorAssignmentsHandler({
        data: {
          page: 1,
          limit: 20,
          search: 'context',
          termId: 3,
          courseId: 4,
          sectionId: 12,
          status: 'active',
        } as any,
      });

      expect(result).toEqual({ assignments: [], total: 0 });
    });

    it('maps instructor list query failures to an internal error', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockDb.then.mockImplementationOnce(
        (_onfulfilled: (value: unknown) => unknown, onrejected: (reason: unknown) => unknown) =>
          Promise.reject(new Error('list failed')).catch(onrejected),
      );

      const result = await listInstructorAssignmentsHandler({
        data: { page: 1, limit: 20, search: '' } as any,
      });

      expect(isServerError(result)).toBe(true);
      if (isServerError(result)) expect(result.error.code).toBe('INTERNAL');
    });

    it('returns null for unauthorized and missing instructor details', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null as any);
      expect(await getAssignmentDetailHandler({ data: { id: 77 } })).toBeNull();
      expect(dbMod.getDb).not.toHaveBeenCalled();

      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockDb.then.mockImplementationOnce((onfulfilled: (value: unknown) => unknown) =>
        Promise.resolve([]).then(onfulfilled),
      );
      expect(await getAssignmentDetailHandler({ data: { id: 77 } })).toBeNull();
    });

    it('maps instructor detail context, progress, and empty student checkpoints', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockDb.then
        .mockImplementationOnce((onfulfilled: (value: unknown) => unknown) =>
          Promise.resolve([
            {
              id: 77,
              title: 'Contextual Assignment',
              description: null,
              finalDeadline: new Date('2027-01-01T00:00:00.000Z'),
              createdAt: null,
              templateName: 'Template',
              templateType: 'Thesis',
              sectionId: 12,
              mode: 'individual',
              status: 'active',
              termId: 3,
              termCode: '2026-FALL',
              termName: 'Fall 2026',
              courseId: 4,
              courseCode: 'CS101',
              courseName: 'Computer Science',
              sectionCode: 'A',
              sectionName: 'Section A',
            },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: (value: unknown) => unknown) =>
          Promise.resolve([
            { id: 'student-1', name: 'Student One', email: 'one@example.com' },
            { id: 'student-2', name: 'Student Two', email: 'two@example.com' },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: (value: unknown) => unknown) =>
          Promise.resolve([
            {
              id: 101,
              name: 'First checkpoint',
              order: 1,
              state: 'passed',
              studentId: 'student-1',
              dueDate: new Date('2026-12-01T00:00:00.000Z'),
              minConsultations: 0,
            },
            {
              id: 102,
              name: 'Second checkpoint',
              order: 2,
              state: 'unlocked',
              studentId: 'student-1',
              dueDate: null,
              minConsultations: null,
            },
          ]).then(onfulfilled),
        );

      const result = await getAssignmentDetailHandler({ data: { id: 77 } });

      expect(result).toMatchObject({
        id: 77,
        createdAt: null,
        context: {
          term: { id: 3, code: '2026-FALL', name: 'Fall 2026' },
          course: { id: 4, code: 'CS101', name: 'Computer Science' },
          section: { id: 12, code: 'A', name: 'Section A' },
        },
        students: [
          {
            id: 'student-1',
            passedCount: 1,
            totalCheckpointsCount: 2,
            progressPercent: 50,
            activeCheckpoint: { id: 102, state: 'unlocked' },
            effectiveDeadline: null,
          },
          {
            id: 'student-2',
            passedCount: 0,
            totalCheckpointsCount: 0,
            progressPercent: 0,
            activeCheckpoint: null,
            effectiveDeadline: null,
          },
        ],
      });
    });

    it('maps instructor detail query failures to an internal error', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(instructorSession as any);
      mockDb.then.mockImplementationOnce(
        (_onfulfilled: (value: unknown) => unknown, onrejected: (reason: unknown) => unknown) =>
          Promise.reject(new Error('detail failed')).catch(onrejected),
      );

      const result = await getAssignmentDetailHandler({ data: { id: 77 } });

      expect(isServerError(result)).toBe(true);
      if (isServerError(result)) expect(result.error.code).toBe('INTERNAL');
    });

    it('covers shared context authorization, membership, and projection helpers', async () => {
      mockDb.then
        .mockImplementationOnce((onfulfilled: (value: unknown) => unknown) =>
          Promise.resolve([{ sectionId: 12 }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: (value: unknown) => unknown) =>
          Promise.resolve([{ id: 'student-1' }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: (value: unknown) => unknown) =>
          Promise.resolve([
            {
              termId: 3,
              termCode: '2026-FALL',
              termName: 'Fall 2026',
              courseId: 4,
              courseCode: 'CS101',
              courseName: 'Computer Science',
              sectionId: 12,
              sectionCode: 'A',
              sectionName: 'Section A',
            },
          ]).then(onfulfilled),
        );

      await expect(getAuthorizedInstructorSection(mockDb, 12, 'instructor-1')).resolves.toEqual({
        sectionId: 12,
      });
      await expect(getActiveSectionStudentIds(mockDb, 12, ['student-1'])).resolves.toEqual([
        { id: 'student-1' },
      ]);

      const context = await getAssignmentContext(mockDb, 12);
      expect(toAssignmentContextProjection(context!)).toEqual({
        term: { id: 3, code: '2026-FALL', name: 'Fall 2026' },
        course: { id: 4, code: 'CS101', name: 'Computer Science' },
        section: { id: 12, code: 'A', name: 'Section A' },
      });
    });

    it('returns null for missing shared context rows', async () => {
      mockDb.then
        .mockImplementationOnce((onfulfilled: (value: unknown) => unknown) =>
          Promise.resolve([]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: (value: unknown) => unknown) =>
          Promise.resolve([]).then(onfulfilled),
        );

      await expect(getAuthorizedInstructorSection(mockDb, 12, 'instructor-1')).resolves.toBeNull();
      await expect(getAssignmentContext(mockDb, 12)).resolves.toBeNull();
    });
  });

  it('exposes a server-validated lifecycle transition handler', () => {
    expect(
      (assignmentHandlers as Record<string, unknown>).transitionAssignmentStatusHandler,
    ).toBeTypeOf('function');
  });
});
