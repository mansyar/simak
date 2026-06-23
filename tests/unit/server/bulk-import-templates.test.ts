/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BulkCreateTemplatesSchema } from '@/server/bulk-import';
import { bulkCreateTemplatesHandler } from '@/server/bulk-import.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import * as audit from '@/lib/audit';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

describe('Bulk template import handler', () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    then: vi.fn(function (onfulfilled: any) {
      return Promise.resolve([]).then(onfulfilled);
    }),
  };

  function mockReturning(data: any) {
    mockDb.returning.mockReturnValue({
      then: (onfulfilled: any) => Promise.resolve(data).then(onfulfilled),
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: {
        id: 'admin-123',
        role: 'admin',
        name: 'Admin User',
        email: 'admin@test.com',
        locale: 'en',
      },
    } as any);
  });

  describe('All-valid success', () => {
    it('should create all templates and return created count', async () => {
      // Mock returning for template insert (called twice for two templates)
      mockReturning([{ id: 1 }]);

      const result = (await bulkCreateTemplatesHandler({
        data: {
          rows: [
            {
              templateName: 'Template A',
              type: 'assignment',
              checkpointName: 'CP1',
              minConsultations: 0,
              estimatedDuration: 7,
            },
            {
              templateName: 'Template A',
              type: 'assignment',
              checkpointName: 'CP2',
              minConsultations: 1,
              estimatedDuration: 14,
            },
            {
              templateName: 'Template B',
              type: 'project',
              checkpointName: 'CP1',
              minConsultations: 0,
              estimatedDuration: 7,
            },
          ],
        },
      })) as any;

      expect(result.created).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Per-group atomicity', () => {
    it('should skip invalid groups and create valid ones', async () => {
      // Template A: invalid (empty checkpoint name)
      // Template B: valid
      mockReturning([{ id: 2 }]);

      const result = (await bulkCreateTemplatesHandler({
        data: {
          rows: [
            {
              templateName: 'Template A',
              type: 'assignment',
              checkpointName: '',
              minConsultations: 0,
              estimatedDuration: 7,
            },
            {
              templateName: 'Template B',
              type: 'project',
              checkpointName: 'CP1',
              minConsultations: 0,
              estimatedDuration: 7,
            },
          ],
        },
      })) as any;

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].templateName).toBe('Template A');
    });
  });

  describe('Invalid group validation', () => {
    it('should reject group with inconsistent type', async () => {
      const result = (await bulkCreateTemplatesHandler({
        data: {
          rows: [
            {
              templateName: 'Template A',
              type: 'assignment',
              checkpointName: 'CP1',
              minConsultations: 0,
              estimatedDuration: 7,
            },
            {
              templateName: 'Template A',
              type: 'project',
              checkpointName: 'CP2',
              minConsultations: 0,
              estimatedDuration: 7,
            },
          ],
        },
      })) as any;

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors[0].reason).toContain('Inconsistent type');
    });

    it('should reject group with no checkpoints', async () => {
      const result = (await bulkCreateTemplatesHandler({
        data: {
          rows: [],
        },
      })) as any;

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Row-limit', () => {
    it('should reject imports exceeding 500 checkpoint rows', async () => {
      const rows = Array.from({ length: 501 }, (_, i) => ({
        templateName: `Template ${Math.floor(i / 10)}`,
        type: 'assignment',
        checkpointName: `CP${i}`,
        minConsultations: 0,
        estimatedDuration: 7,
      }));

      const result = (await bulkCreateTemplatesHandler({
        data: { rows },
      })) as any;

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors[0].reason).toContain('500');
    });
  });

  describe('Audit log', () => {
    it('should write template.bulk_created audit log', async () => {
      mockReturning([{ id: 1 }]);

      (await bulkCreateTemplatesHandler({
        data: {
          rows: [
            {
              templateName: 'Template A',
              type: 'assignment',
              checkpointName: 'CP1',
              minConsultations: 0,
              estimatedDuration: 7,
            },
          ],
        },
      })) as any;

      expect(audit.logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'template.bulk_created',
        }),
      );
    });
  });

  describe('Session/role verification', () => {
    it('should reject unauthenticated requests', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);

      const result = (await bulkCreateTemplatesHandler({
        data: {
          rows: [
            {
              templateName: 'Template A',
              type: 'assignment',
              checkpointName: 'CP1',
              minConsultations: 0,
              estimatedDuration: 7,
            },
          ],
        },
      })) as any;

      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should reject non-admin roles', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'instructor-123', role: 'instructor' },
      } as any);

      const result = (await bulkCreateTemplatesHandler({
        data: {
          rows: [
            {
              templateName: 'Template A',
              type: 'assignment',
              checkpointName: 'CP1',
              minConsultations: 0,
              estimatedDuration: 7,
            },
          ],
        },
      })) as any;

      expect(result).toEqual({ error: 'Unauthorized' });
    });
  });
});
