/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createTemplateHandler,
  listTemplatesHandler,
  getTemplateHandler,
  updateTemplateHandler,
  deleteTemplateHandler,
  duplicateTemplateHandler,
  listTemplateAssignmentsHandler,
} from '@/server/templates.server';
import { serverError, ErrorCode } from '@/lib/errors';
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
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

describe('Template server functions - Logic & Security', () => {
  let returningResult: any = null;

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

  function mockReturning(data: any) {
    returningResult = data;
    mockDb.returning.mockReturnValue({
      then: (onfulfilled: any) => Promise.resolve(data).then(onfulfilled),
    });
  }

  const adminSession = {
    user: { id: 'admin-1', role: 'admin' } as any,
    session: {} as any,
  };

  const superAdminSession = {
    user: { id: 'super-1', role: 'superadmin' } as any,
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

  describe('createTemplate', () => {
    const createData = {
      name: 'Thesis Template',
      type: 'Thesis',
      checkpoints: [
        { name: 'Chapter 1', minConsultations: 0, estimatedDuration: 7 },
        { name: 'Chapter 2', minConsultations: 0, estimatedDuration: 7 },
      ],
    };

    it('should fail if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await createTemplateHandler({ data: createData });
      expect(result).toEqual(serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized'));
    });

    it('should fail if student tries to create template', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
      const result = await createTemplateHandler({ data: createData });
      expect(result).toEqual(serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized'));
    });

    it('should create template with checkpoints for admin', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);

      mockReturning([{ id: 1 }]);

      const result = await createTemplateHandler({ data: createData });

      expect(result).toHaveProperty('template');
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalled();
    });

    it('should set createdBy from session user ID', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);

      mockReturning([{ id: 1 }]);

      await createTemplateHandler({ data: createData });

      const valuesCalls = vi.mocked(mockDb.values).mock.calls;
      const insertValues = valuesCalls[0][0];
      expect(insertValues.createdBy).toBe('admin-1');
    });
  });

  describe('listTemplates', () => {
    const listData = { page: 1, limit: 20, search: '', type: '' };

    it('should return templates and total count', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1, name: 'Template 1', type: 'Thesis' }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ templateId: 1, count: 3 }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ templateId: 1, name: 'Proposal', order: 1 }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 1 }]).then(onfulfilled),
        );

      const result = (await listTemplatesHandler({ data: listData })) as {
        templates: { checkpointCount: number }[];
        total: number;
      };

      expect(result.templates).toHaveLength(1);
      expect(result.templates[0].checkpointCount).toBe(3);
      expect(result.total).toBe(1);
    });

    it('should exclude soft-deleted templates', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 0 }]).then(onfulfilled),
        );

      await listTemplatesHandler({ data: listData });

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should search by name', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 0 }]).then(onfulfilled),
        );

      await listTemplatesHandler({ data: { ...listData, search: 'thesis' } });

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should filter by type', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 0 }]).then(onfulfilled),
        );

      await listTemplatesHandler({ data: { ...listData, type: 'Thesis' } });

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should return empty for non-instructor/non-admin session', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);

      const result = await listTemplatesHandler({ data: listData });
      expect(result).toEqual({ templates: [], total: 0, allTypes: [] });
    });

    it('should return allTypes array of distinct types', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1, name: 'Template 1', type: 'Thesis' }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ templateId: 1, count: 3 }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ templateId: 1, name: 'Proposal', order: 1 }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ count: 1 }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ type: 'Thesis' }, { type: 'Project' }]).then(onfulfilled),
        );

      const result = (await listTemplatesHandler({ data: listData })) as {
        allTypes: string[];
      };

      expect(result.allTypes).toBeDefined();
      expect(result.allTypes).toEqual(['Thesis', 'Project']);
    });
  });

  describe('getTemplate', () => {
    it('should return template with checkpoints', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1, name: 'Thesis', type: 'Thesis' }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ assignmentCount: 0 }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1, name: 'Ch 1', order: 1 }]).then(onfulfilled),
        );

      const result = await getTemplateHandler({ data: { id: 1 } });

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('checkpoints');
    });

    it('should return null for non-existent template', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);

      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );

      const result = await getTemplateHandler({ data: { id: 999 } });
      expect(result).toBeNull();
    });

    it('should fail if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await getTemplateHandler({ data: { id: 1 } });
      expect(result).toBeNull();
    });

    it('should return null for non-instructor/non-admin session', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);
      const result = await getTemplateHandler({ data: { id: 1 } });
      expect(result).toBeNull();
    });
  });

  describe('updateTemplate', () => {
    const updateData = {
      name: 'Updated Template',
      type: 'Thesis',
      checkpoints: [
        { name: 'New Ch 1', minConsultations: 0, estimatedDuration: 7 },
        { name: 'New Ch 2', minConsultations: 0, estimatedDuration: 7 },
      ],
    };

    it('should fail if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await updateTemplateHandler({ data: { id: 1, ...updateData } });
      expect(result).toEqual(serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized'));
    });

    it('should update template and replace checkpoints', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);

      const result = await updateTemplateHandler({ data: { id: 1, ...updateData } });

      expect(result).toHaveProperty('success');
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('deleteTemplate', () => {
    it('should soft-delete unused template', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);

      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 0 }]).then(onfulfilled),
      );

      const result = await deleteTemplateHandler({ data: { id: 1 } });
      expect(result).toEqual({ success: true });
    });

    it('should return in_use error with count when assignments reference it', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);

      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 3 }]).then(onfulfilled),
      );

      const result = await deleteTemplateHandler({ data: { id: 1 } });
      expect(result).toEqual(serverError(ErrorCode.BAD_REQUEST, 'in_use', { input: { count: 3 } }));
    });

    it('should fail if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await deleteTemplateHandler({ data: { id: 1 } });
      expect(result).toEqual(serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized'));
    });
  });

  describe('duplicateTemplate', () => {
    const templateDetail = {
      id: 1,
      name: 'Thesis Copy',
      type: 'Thesis',
      createdBy: 'admin-1',
      createdByName: 'Admin',
      createdAt: null,
      updatedAt: null,
      checkpoints: [],
      assignmentCount: 0,
    };

    it('should duplicate template with checkpoints and append (Copy)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1, name: 'Thesis', type: 'Thesis', createdBy: 'admin-1' }]).then(
            onfulfilled,
          ),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([
            { id: 1, name: 'Ch 1', order: 1, templateId: 1 },
            { id: 2, name: 'Ch 2', order: 2, templateId: 1 },
          ]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 2 }]).then(onfulfilled),
        );

      const result = await duplicateTemplateHandler({ data: { id: 1 } });
      expect(result).toHaveProperty('template');
    });

    it('should fail if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await duplicateTemplateHandler({ data: { id: 1 } });
      expect(result).toEqual(serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized'));
    });

    it('should return error for non-existent template', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);
      const result = await duplicateTemplateHandler({ data: { id: 999 } });
      expect(result).toEqual(serverError(ErrorCode.NOT_FOUND, 'Template not found'));
    });
  });

  describe('listTemplateAssignments', () => {
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
          Promise.resolve([
            { assignmentId: 1, count: 5 },
            { assignmentId: 2, count: 3 },
          ]).then(onfulfilled),
        );

      const result = (await listTemplateAssignmentsHandler({
        data: { templateId: 1 },
      })) as { assignments: { studentCount: number }[] };

      expect(result.assignments).toHaveLength(2);
      expect(result.assignments[0]).toEqual({
        id: 1,
        title: 'Assignment 1',
        instructorName: 'Dr. Smith',
        studentCount: 5,
        createdAt: expect.any(Date),
      });
      expect(result.assignments[1].studentCount).toBe(3);
    });

    it('should return empty assignments for non-admin', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(studentSession);

      const result = await listTemplateAssignmentsHandler({ data: { templateId: 1 } });
      expect(result).toEqual({ assignments: [] });
    });

    it('should return empty assignments for null session', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);

      const result = await listTemplateAssignmentsHandler({ data: { templateId: 1 } });
      expect(result).toEqual({ assignments: [] });
    });

    it('should return empty array when no assignments exist', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);

      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );

      const result = await listTemplateAssignmentsHandler({ data: { templateId: 999 } });
      expect(result).toEqual({ assignments: [] });
    });
  });
});
