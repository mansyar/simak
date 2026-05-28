import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dbMod from '@/db/index';

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

describe('logAuditEvent', () => {
  const mockDb = {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  it('should write correct row to audit_log table with all fields', async () => {
    const { logAuditEvent } = await import('@/lib/audit');

    await logAuditEvent({
      actorId: 'user-123',
      action: 'user.created',
      entityType: 'user',
      entityId: 'entity-456',
      details: { role: 'admin', email: 'test@example.com' },
    });

    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.values).toHaveBeenCalledWith({
      actorId: 'user-123',
      action: 'user.created',
      entityType: 'user',
      entityId: 'entity-456',
      details: { role: 'admin', email: 'test@example.com' },
    });
  });

  it('should handle missing details gracefully (null)', async () => {
    const { logAuditEvent } = await import('@/lib/audit');

    await logAuditEvent({
      actorId: 'user-123',
      action: 'user.created',
      entityType: 'user',
      entityId: 'entity-456',
    });

    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.values).toHaveBeenCalledWith({
      actorId: 'user-123',
      action: 'user.created',
      entityType: 'user',
      entityId: 'entity-456',
      details: null,
    });
  });

  it('should throw error when actorId is missing', async () => {
    const { logAuditEvent } = await import('@/lib/audit');

    await expect(
      logAuditEvent({
        actorId: '',
        action: 'user.created',
        entityType: 'user',
        entityId: 'entity-456',
      }),
    ).rejects.toThrow('actorId is required');
  });
});
