/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn(),
}));

import { getDb } from '@/db/index';
import { logAuditEvent } from '@/lib/audit';
import { revokeUserSessions } from '@/lib/auth-session';

const mockGetDb = vi.mocked(getDb);
const mockLogAuditEvent = vi.mocked(logAuditEvent);

function createMockDb() {
  const mockWhere = vi.fn().mockResolvedValue(undefined);

  return {
    delete: vi.fn().mockReturnValue({
      where: mockWhere,
    }),
  };
}

describe('revokeUserSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete all sessions for the given user', async () => {
    const mockDb = createMockDb();
    mockGetDb.mockReturnValue(mockDb as any);

    await revokeUserSessions('user-123');

    expect(mockDb.delete).toHaveBeenCalled();
    expect(mockDb.delete().where).toHaveBeenCalled();
  });

  it('should log a session.revoked audit event', async () => {
    const mockDb = createMockDb();
    mockGetDb.mockReturnValue(mockDb as any);

    await revokeUserSessions('user-123');

    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user-123',
        action: 'session.revoked',
        entityType: 'user',
        entityId: 'user-123',
      }),
    );
  });

  it('should handle a user with no existing sessions gracefully', async () => {
    const mockDb = createMockDb();
    mockGetDb.mockReturnValue(mockDb as any);

    await expect(revokeUserSessions('user-no-sessions')).resolves.toBeUndefined();
    expect(mockDb.delete).toHaveBeenCalled();
  });
});
