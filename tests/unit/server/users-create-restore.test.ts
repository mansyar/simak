/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createUserHandler } from '@/server/users.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import * as email from '@/lib/email';
import * as audit from '@/lib/audit';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/email', () => ({
  sendInvitationEmail: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn(),
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

function createChainableMock(baseThenValue: unknown = []) {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    for: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    then: vi.fn((onfulfilled: (value: unknown) => unknown) =>
      Promise.resolve(baseThenValue).then(onfulfilled),
    ),
  };
}

describe('createUserHandler — restore-on-soft-deleted (H3)', () => {
  let mockDb: ReturnType<typeof createChainableMock> & {
    transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      ...createChainableMock(),
      transaction: vi.fn((fn: any) => fn(mockDb)),
    } as unknown as typeof mockDb;

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

  it('should restore a soft-deleted user with the same id and emit user.reactivated', async () => {
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ id: 'deleted-user-1', deletedAt: new Date() }]).then(onfulfilled),
    );

    const result = (await createUserHandler({
      data: { name: 'Restored User', email: 'restore@test.com', role: 'student' },
    })) as any;

    expect(result.error).toBeUndefined();
    expect(result.user.id).toBe('deleted-user-1');
    expect(mockDb.update).toHaveBeenCalled();
    expect(audit.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'user.reactivated',
        entityId: 'deleted-user-1',
        details: expect.objectContaining({ status: 'restored' }),
      }),
    );
    expect(email.sendInvitationEmail).toHaveBeenCalled();
  });

  it('should reject an active duplicate email', async () => {
    mockDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ id: 'active-user-1', deletedAt: null }]).then(onfulfilled),
    );

    const result = (await createUserHandler({
      data: { name: 'Duplicate User', email: 'dup@active.com', role: 'student' },
    })) as any;

    expect(result.error).toBeDefined();
    expect(result.error.code).toBe('BAD_REQUEST');
  });
});
