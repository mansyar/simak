/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import * as auditMod from '@/lib/audit';

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
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

describe('Template handlers audit logging', () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    then: vi.fn(function (onfulfilled) {
      return Promise.resolve([]).then(onfulfilled);
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  describe('createTemplateHandler', () => {
    it('should write template.created audit entry on successful creation', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' } as any,
        session: {} as any,
      });

      // Mock returning to return inserted id
      mockDb.returning.mockResolvedValueOnce([{ id: 123 }]);
      // Mock then for getTemplateHandler
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );

      const { createTemplateHandler } = await import('@/server/templates.server');
      await createTemplateHandler({
        data: {
          name: 'Test Template',
          type: 'Thesis',
          checkpoints: [{ name: 'Chapter 1', minConsultations: 0, estimatedDuration: 7 }],
        },
      });

      expect(auditMod.logAuditEvent).toHaveBeenCalledWith({
        actorId: 'admin-1',
        action: 'template.created',
        entityType: 'template',
        entityId: '123',
        details: { name: 'Test Template', type: 'Thesis', checkpointCount: 1 },
      });
    });
  });

  describe('updateTemplateHandler', () => {
    it('should write template.updated audit entry on successful update', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' } as any,
        session: {} as any,
      });

      const { updateTemplateHandler } = await import('@/server/templates.server');
      await updateTemplateHandler({
        data: {
          id: 123,
          name: 'Updated Template',
          type: 'Thesis',
          checkpoints: [{ name: 'Chapter 1', minConsultations: 0, estimatedDuration: 7 }],
        },
      });

      expect(auditMod.logAuditEvent).toHaveBeenCalledWith({
        actorId: 'admin-1',
        action: 'template.updated',
        entityType: 'template',
        entityId: '123',
        details: { name: 'Updated Template', type: 'Thesis', checkpointCount: 1 },
      });
    });
  });

  describe('deleteTemplateHandler', () => {
    it('should write template.deleted audit entry on successful soft-delete', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
        user: { id: 'admin-1', role: 'admin' } as any,
        session: {} as any,
      });

      // Mock count query returning 0 (no active assignments)
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 0 }]).then(onfulfilled),
      );

      const { deleteTemplateHandler } = await import('@/server/templates.server');
      await deleteTemplateHandler({
        data: { id: 456 },
      });

      expect(auditMod.logAuditEvent).toHaveBeenCalledWith({
        actorId: 'admin-1',
        action: 'template.deleted',
        entityType: 'template',
        entityId: '456',
        details: undefined,
      });
    });
  });
});
