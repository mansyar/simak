/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bulkCreateUsersHandler } from '@/server/bulk-import.server';
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

type ChainableMock = ReturnType<typeof createChainableMock>;

function createChainableMock(baseThenValue: unknown = []) {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
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

describe('Bulk user import handler — restore / skip behavior (H3)', () => {
  let innerDb: ChainableMock;
  let outerDb: ChainableMock & { transaction: ReturnType<typeof vi.fn> };
  let mockDb: ChainableMock & { transaction: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    innerDb = createChainableMock();
    outerDb = {
      ...createChainableMock(),
      transaction: vi
        .fn()
        .mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
          return callback(innerDb);
        }),
    };
    mockDb = {
      ...createChainableMock(),
      transaction: vi
        .fn()
        .mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
          return callback(outerDb);
        }),
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

  it('should restore a soft-deleted user and report status restored', async () => {
    (innerDb.then as any).mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ id: 'deleted-user-1', deletedAt: new Date() }]).then(onfulfilled),
    );

    const result = (await bulkCreateUsersHandler({
      data: {
        rows: [{ name: 'Restored User', email: 'restore@test.com', role: 'student' }],
      },
    })) as any;

    expect(result.error).toBeUndefined();
    expect(result.results[0]).toMatchObject({
      rowIndex: 1,
      email: 'restore@test.com',
      status: 'restored',
    });
  });

  it('should skip a row with an active duplicate email and report status skipped', async () => {
    (innerDb.then as any).mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ id: 'active-user-1', deletedAt: null }]).then(onfulfilled),
    );

    const result = (await bulkCreateUsersHandler({
      data: {
        rows: [{ name: 'Duplicate User', email: 'dup@active.com', role: 'student' }],
      },
    })) as any;

    expect(result.error).toBeUndefined();
    expect(result.results[0]).toMatchObject({
      rowIndex: 1,
      email: 'dup@active.com',
      status: 'skipped',
    });
    expect(result.results[0].reason).toBeTruthy();
  });

  it('should catch unique_violation per-row and continue the batch', async () => {
    // Simulate a race: both rows report no existing user at select time, but the
    // first insert collides with a concurrent commit and throws a unique violation.
    (innerDb.then as any)
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled))
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    const uniqueViolationError = Object.assign(new Error('duplicate key value'), { code: '23505' });
    innerDb.insert.mockImplementationOnce(() => {
      throw uniqueViolationError;
    });

    const result = (await bulkCreateUsersHandler({
      data: {
        rows: [
          { name: 'First User', email: 'race@test.com', role: 'student' },
          { name: 'Second User', email: 'second@test.com', role: 'student' },
        ],
      },
    })) as any;

    expect(result.error).toBeUndefined();
    expect(result.results[0].status).toBe('skipped');
    expect(result.results[1].status).toBe('created');
  });

  it('should roll back the whole batch on a non-23505 per-row error', async () => {
    (innerDb.then as any).mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([]).then(onfulfilled),
    );

    const fatalError = Object.assign(new Error('check constraint violation'), { code: '23514' });
    innerDb.insert.mockImplementationOnce(() => {
      throw fatalError;
    });

    const result = (await bulkCreateUsersHandler({
      data: {
        rows: [{ name: 'Bad User', email: 'bad@test.com', role: 'student' }],
      },
    })) as any;

    expect(result.error).toBeDefined();
    expect(result.error.code).toBe('INTERNAL');
  });

  it('should emit user.reactivated and user.created via batch INSERT (PERF-6)', async () => {
    (innerDb.then as any)
      .mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ id: 'deleted-user-2', deletedAt: new Date() }]).then(onfulfilled),
      )
      .mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    const result = (await bulkCreateUsersHandler({
      data: {
        rows: [
          { name: 'Restore One', email: 'restore1@test.com', role: 'student' },
          { name: 'New One', email: 'new1@test.com', role: 'student' },
        ],
      },
    })) as any;

    expect(result.error).toBeUndefined();
    // PERF-6: Per-row audits are batched into a single db.insert(auditLog).values([...])
    // Only user.bulk_created goes through logAuditEvent
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'user.reactivated',
          entityId: 'deleted-user-2',
        }),
        expect.objectContaining({
          action: 'user.created',
        }),
      ]),
    );
  });

  it('should perform a single outer batch audit log user.bulk_created', async () => {
    (innerDb.then as any).mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ id: 'deleted-user-3', deletedAt: new Date() }]).then(onfulfilled),
    );

    await bulkCreateUsersHandler({
      data: {
        rows: [{ name: 'Restore Two', email: 'restore2@test.com', role: 'student' }],
      },
    });

    expect(audit.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'user.bulk_created',
        entityId: 'admin-123',
      }),
    );
  });
});
