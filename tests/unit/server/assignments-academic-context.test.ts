/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateAssignmentSchema, ListInstructorAssignmentsSchema } from '@/server/assignments';
import * as assignmentHandlers from '@/server/assignments.server';
import {
  createAssignmentHandler,
  listInstructorAssignmentsHandler,
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
  });

  it('exposes a server-validated lifecycle transition handler', () => {
    expect(
      (assignmentHandlers as Record<string, unknown>).transitionAssignmentStatusHandler,
    ).toBeTypeOf('function');
  });
});
