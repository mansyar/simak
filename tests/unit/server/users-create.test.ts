/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateUserSchema } from '@/server/users';
import { createUserHandler } from '@/server/users.server';
import * as auth from '@/server/auth';
import * as email from '@/lib/email';
import * as dbMod from '@/db/index';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/lib/email', () => ({
  sendInvitationEmail: vi.fn(),
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

describe('createUserHandler', () => {
  const txDb = {
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
    for: vi.fn().mockReturnThis(),
    then: vi.fn(function (onfulfilled) {
      return Promise.resolve([]).then(onfulfilled);
    }),
  };

  const mockDb = {
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
    for: vi.fn().mockReturnThis(),
    then: vi.fn(function (onfulfilled) {
      return Promise.resolve([]).then(onfulfilled);
    }),
    transaction: vi.fn(async (callback) => callback(txDb)),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  it('should fail if unauthorized', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
    const result = await createUserHandler({
      data: { name: 'Test', email: 'test@example.com', role: 'student' },
    });
    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  });

  it('should fail if student tries to create user', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: '1', role: 'student' } as any,
      session: {} as any,
    });
    const result = await createUserHandler({
      data: { name: 'Test', email: 'test@example.com', role: 'student' },
    });
    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  });

  it('should allow admin to create instructor', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' } as any,
      session: {} as any,
    });

    mockDb.then.mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    const result = await createUserHandler({
      data: { name: 'New Instructor', email: 'inst@example.com', role: 'instructor' },
    });

    expect(result).toHaveProperty('user');
    expect(result).toHaveProperty('emailSent');
    expect(email.sendInvitationEmail).toHaveBeenCalled();
  });

  it('should prevent admin from creating superadmin at schema level', async () => {
    const result = CreateUserSchema.safeParse({
      name: 'Bad',
      email: 'bad@example.com',
      role: 'superadmin',
    });
    expect(result.success).toBe(false);
  });

  it('should prevent admin from creating another admin', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' } as any,
      session: {} as any,
    });

    const result = await createUserHandler({
      data: { name: 'Other Admin', email: 'admin2@example.com', role: 'admin' },
    });
    expect(result).toEqual({
      error: { code: 'BAD_REQUEST', message: 'Admins cannot create other Admin accounts' },
    });
  });

  it('should prevent superadmin from creating instructor (scope violation)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: 'super-1', role: 'superadmin' } as any,
      session: {} as any,
    });

    const result = await createUserHandler({
      data: { name: 'Bad Instructor', email: 'inst@example.com', role: 'instructor' },
    });
    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  });

  it('should prevent superadmin from creating student (scope violation)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: 'super-1', role: 'superadmin' } as any,
      session: {} as any,
    });

    const result = await createUserHandler({
      data: { name: 'Bad Student', email: 'student@example.com', role: 'student' },
    });
    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  });

  it('should allow superadmin to create admin', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: 'super-1', role: 'superadmin' } as any,
      session: {} as any,
    });

    mockDb.then.mockImplementationOnce((onfulfilled: any) => Promise.resolve([]).then(onfulfilled));

    const result = await createUserHandler({
      data: { name: 'New Admin', email: 'admin2@example.com', role: 'admin' },
    });
    expect(result).toHaveProperty('user');
    expect(email.sendInvitationEmail).toHaveBeenCalled();
  });

  it('should reject duplicate email (checked inside transaction with FOR UPDATE)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' } as any,
      session: {} as any,
    });

    txDb.then.mockImplementationOnce((onfulfilled: any) =>
      Promise.resolve([{ id: 'existing-user', deletedAt: null }]).then(onfulfilled),
    );

    const result = await createUserHandler({
      data: { name: 'Duplicate', email: 'existing@test.com', role: 'student' },
    });
    expect(result).toEqual({
      error: { code: 'BAD_REQUEST', message: 'Email already in use' },
    });
    expect(txDb.for).toHaveBeenCalledWith(
      'update',
      expect.objectContaining({ of: expect.anything() }),
    );
  });

  it('should wrap user and verification inserts in a transaction', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' } as any,
      session: {} as any,
    });

    await createUserHandler({
      data: { name: 'Tx User', email: 'tx@example.com', role: 'student' },
    });

    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(txDb.select).toHaveBeenCalled();
    expect(txDb.insert).toHaveBeenCalledTimes(2);
  });

  it('should return an error and not send email when the transaction fails', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' } as any,
      session: {} as any,
    });

    mockDb.transaction.mockRejectedValueOnce(new Error('verification insert failed'));

    const result = await createUserHandler({
      data: { name: 'Failing', email: 'fail@example.com', role: 'student' },
    });

    expect(result).toEqual({
      error: {
        code: 'INTERNAL',
        message: 'Internal Server Error',
      },
    });
    expect(email.sendInvitationEmail).not.toHaveBeenCalled();
  });

  it('should catch unique constraint violation (23505) and return email-in-use error', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' } as any,
      session: {} as any,
    });

    const pgError = new Error('duplicate key value violates unique constraint');
    (pgError as any).code = '23505';
    mockDb.transaction.mockRejectedValueOnce(pgError);

    const result = await createUserHandler({
      data: { name: 'Race', email: 'race@test.com', role: 'student' },
    });

    expect(result).toEqual({
      error: { code: 'BAD_REQUEST', message: 'Email already in use' },
    });
  });
});
