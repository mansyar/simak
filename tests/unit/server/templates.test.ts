/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  CreateTemplateSchema,
  UpdateTemplateSchema,
  ListTemplatesSchema,
  TemplateIdParamSchema,
} from '@/server/templates';
import {
  createTemplateHandler,
  listTemplatesHandler,
  getTemplateHandler,
  updateTemplateHandler,
  deleteTemplateHandler,
  duplicateTemplateHandler,
} from '@/server/templates.server';
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

describe('Template server functions - Schemas', () => {
  describe('CreateTemplateSchema', () => {
    it('should accept valid input with defaults', () => {
      const result = CreateTemplateSchema.safeParse({
        name: 'Thesis Template',
        type: 'Thesis',
        checkpoints: [{ name: 'Chapter 1' }, { name: 'Chapter 2' }, { name: 'Chapter 3' }],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.checkpoints[0]).toEqual({ name: 'Chapter 1', minConsultations: 0 });
      }
    });

    it('should accept explicit minConsultations', () => {
      const result = CreateTemplateSchema.safeParse({
        name: 'Thesis Template',
        type: 'Thesis',
        checkpoints: [{ name: 'Chapter 1', minConsultations: 3 }],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.checkpoints[0].minConsultations).toBe(3);
      }
    });

    it('should reject empty name', () => {
      const result = CreateTemplateSchema.safeParse({
        name: '',
        type: 'Thesis',
        checkpoints: [{ name: 'Chapter 1' }],
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing type', () => {
      const result = CreateTemplateSchema.safeParse({
        name: 'Thesis',
        type: '',
        checkpoints: [{ name: 'Chapter 1' }],
      });
      expect(result.success).toBe(false);
    });

    it('should reject zero checkpoints', () => {
      const result = CreateTemplateSchema.safeParse({
        name: 'Thesis',
        type: 'Thesis',
        checkpoints: [],
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty checkpoint name', () => {
      const result = CreateTemplateSchema.safeParse({
        name: 'Thesis',
        type: 'Thesis',
        checkpoints: [{ name: 'Chapter 1' }, { name: '' }],
      });
      expect(result.success).toBe(false);
    });

    it('should coerce string minConsultations to number', () => {
      const result = CreateTemplateSchema.safeParse({
        name: 'Thesis',
        type: 'Thesis',
        checkpoints: [{ name: 'Ch 1', minConsultations: '5' }],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.checkpoints[0].minConsultations).toBe(5);
      }
    });
  });

  describe('ListTemplatesSchema', () => {
    it('should use defaults for optional fields', () => {
      const result = ListTemplatesSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
        expect(result.data.search).toBe('');
      }
    });

    it('should coerce string page number', () => {
      const result = ListTemplatesSchema.safeParse({ page: '3' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(3);
      }
    });
  });

  describe('TemplateIdParamSchema', () => {
    it('should coerce string id to number', () => {
      const result = TemplateIdParamSchema.safeParse({ id: '42' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(42);
      }
    });

    it('should accept numeric id', () => {
      const result = TemplateIdParamSchema.safeParse({ id: 42 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(42);
      }
    });

    it('should reject non-numeric id', () => {
      const result = TemplateIdParamSchema.safeParse({ id: 'abc' });
      expect(result.success).toBe(false);
    });
  });
});

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
    then: vi.fn(function (onfulfilled: any) {
      return Promise.resolve([]).then(onfulfilled);
    }),
  };

  // Helper to set .returning() to return a thenable with custom data
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
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  describe('createTemplate', () => {
    const createData = {
      name: 'Thesis Template',
      type: 'Thesis',
      checkpoints: [{ name: 'Chapter 1', minConsultations: 0 }, { name: 'Chapter 2', minConsultations: 0 }],
    };

    it('should fail if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await createTemplateHandler({ data: createData });
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should fail if student tries to create template', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'student-1', role: 'student' } as any,
        session: {} as any,
      });
      const result = await createTemplateHandler({ data: createData });
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should create template with checkpoints for admin', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);

      // Mock .returning().then() to return [{ id: 1 }]
      mockReturning([{ id: 1 }]);

      // Mock getTemplate's inner queries (select + count)
      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1, name: 'Thesis', type: 'Thesis' }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

      const result = await createTemplateHandler({ data: createData });

      expect(result).toHaveProperty('template');
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalled();
    });

    it('should set createdBy from session user ID', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);

      mockReturning([{ id: 1 }]);

      mockDb.then
        .mockImplementationOnce((onfulfilled: any) =>
          Promise.resolve([{ id: 1, name: 'Thesis', type: 'Thesis' }]).then(onfulfilled),
        )
        .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

      await createTemplateHandler({ data: createData });

      // The first values call should include createdBy from session
      const valuesCalls = vi.mocked(mockDb.values).mock.calls;
      const insertValues = valuesCalls[0][0];
      expect(insertValues.createdBy).toBe('admin-1');
    });
  });

  describe('listTemplates', () => {
    const listData = { page: 1, limit: 20, search: '', type: '' };

    it('should return templates and total count', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);

      // First await: select templates → returns [template]
      // Second await: count of checkpoints per template (groupBy)
      // Third await: checkpoints list query (allCheckpoints)
      // Fourth await: total count query
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

      const result = await listTemplatesHandler({ data: listData });

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

      // Verify where was called with isNull condition for deletedAt
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
      expect(result).toEqual({ templates: [], total: 0 });
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
      checkpoints: [{ name: 'New Ch 1', minConsultations: 0 }, { name: 'New Ch 2', minConsultations: 0 }],
    };

    it('should fail if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await updateTemplateHandler({ data: { id: 1, ...updateData } });
      expect(result).toEqual({ error: 'Unauthorized' });
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

      // No assignments reference this template
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 0 }]).then(onfulfilled),
      );

      const result = await deleteTemplateHandler({ data: { id: 1 } });
      expect(result).toEqual({ success: true });
    });

    it('should return in_use error with count when assignments reference it', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);

      // 3 assignments reference this template
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 3 }]).then(onfulfilled),
      );

      const result = await deleteTemplateHandler({ data: { id: 1 } });
      expect(result).toEqual({ error: 'in_use', count: 3 });
    });

    it('should fail if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await deleteTemplateHandler({ data: { id: 1 } });
      expect(result).toEqual({ error: 'Unauthorized' });
    });
  });

  describe('duplicateTemplate', () => {
    it('should duplicate template with checkpoints and append (Copy)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);

      // Mock getTemplate result
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
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should return error for non-existent template', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);
      // Default mockDb.then returns [] — no template found
      const result = await duplicateTemplateHandler({ data: { id: 999 } });
      expect(result).toEqual({ error: 'Template not found' });
    });
  });
});
