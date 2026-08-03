/** @vitest-environment node */
import { beforeEach, describe, it, expect, vi } from 'vitest';
import {
  CreateTemplateSchema,
  UpdateTemplateSchema,
  ListTemplatesSchema,
  TemplateIdParamSchema,
  ListTemplateAssignmentsSchema,
} from '@/server/templates';
import { listTemplatesHandler } from '@/server/templates.server';
import { listTemplateTypesHandler } from '@/server/templates-extras.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
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
        expect(result.data.checkpoints[0]).toEqual({
          name: 'Chapter 1',
          minConsultations: 0,
          estimatedDuration: 7,
        });
      }
    });

    it('should accept explicit minConsultations', () => {
      const result = CreateTemplateSchema.safeParse({
        name: 'Thesis Template',
        type: 'Thesis',
        checkpoints: [{ name: 'Chapter 1', minConsultations: 3, estimatedDuration: 7 }],
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
        checkpoints: [{ name: 'Ch 1', minConsultations: '5', estimatedDuration: 7 }],
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

  describe('ListTemplateAssignmentsSchema', () => {
    it('should coerce string templateId to number', () => {
      const result = ListTemplateAssignmentsSchema.safeParse({ templateId: '5' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.templateId).toBe(5);
      }
    });

    it('should accept numeric templateId', () => {
      const result = ListTemplateAssignmentsSchema.safeParse({ templateId: 5 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.templateId).toBe(5);
      }
    });

    it('should reject non-numeric templateId', () => {
      const result = ListTemplateAssignmentsSchema.safeParse({ templateId: 'abc' });
      expect(result.success).toBe(false);
    });

    it('should reject zero templateId', () => {
      const result = ListTemplateAssignmentsSchema.safeParse({ templateId: 0 });
      expect(result.success).toBe(false);
    });
  });
});

describe('Template list workload', () => {
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {};
    for (const method of ['select', 'from', 'where', 'orderBy', 'limit', 'offset', 'groupBy']) {
      mockDb[method] = vi.fn().mockReturnValue(mockDb);
    }
    mockDb.then = vi.fn((onfulfilled: (value: unknown[]) => unknown) =>
      Promise.resolve([]).then(onfulfilled),
    );
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb);
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
      session: {},
    } as any);
  });

  it('does not run type discovery or duplicate checkpoint queries for a search', async () => {
    mockDb.then
      .mockImplementationOnce((onfulfilled: (value: unknown[]) => unknown) =>
        Promise.resolve([
          {
            id: 1,
            name: 'Draft template',
            type: 'Thesis',
            createdBy: 'admin-1',
            createdAt: null,
            updatedAt: null,
          },
        ]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: (value: unknown[]) => unknown) =>
        Promise.resolve([{ count: 1 }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: (value: unknown[]) => unknown) =>
        Promise.resolve([{ templateId: 1, name: 'Introduction' }]).then(onfulfilled),
      );

    const result = await listTemplatesHandler({
      data: { page: 1, limit: 20, search: 'draft', type: '' },
    });

    expect(result).toMatchObject({ total: 1 });
    expect(mockDb.select).toHaveBeenCalledTimes(3);
    expect(mockDb.groupBy).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      templates: [{ checkpointCount: 1, checkpoints: ['Introduction'] }],
    });
  });

  it('loads type options through an independent query', async () => {
    mockDb.then.mockImplementationOnce((onfulfilled: (value: unknown[]) => unknown) =>
      Promise.resolve([{ type: 'Thesis' }, { type: 'Project' }]).then(onfulfilled),
    );

    await expect(listTemplateTypesHandler({ data: {} })).resolves.toEqual({
      types: ['Thesis', 'Project'],
    });
    expect(mockDb.select).toHaveBeenCalledOnce();
  });
});
