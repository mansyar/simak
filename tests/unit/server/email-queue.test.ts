/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ListEmailQueueSchema,
  RetryEmailSchema,
  listEmailQueue,
  retryEmail,
} from '@/server/email-queue';
import type { ListEmailQueueSuccess } from '@/server/email-queue.server';
import type { ServerError } from '@/lib/errors';
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

// ---- Schema Tests ----

describe('Email queue server function schemas', () => {
  describe('ListEmailQueueSchema', () => {
    it('applies defaults when no input provided', () => {
      const result = ListEmailQueueSchema.parse({});
      expect(result.page).toBe(1);
      expect(result.status).toBe('all');
      expect(result.search).toBe('');
    });

    it('accepts valid status filter', () => {
      const result = ListEmailQueueSchema.parse({ status: 'failed' });
      expect(result.status).toBe('failed');
    });

    it('accepts search string', () => {
      const result = ListEmailQueueSchema.parse({ search: 'user@example.com' });
      expect(result.search).toBe('user@example.com');
    });

    it('accepts page number', () => {
      const result = ListEmailQueueSchema.parse({ page: 3 });
      expect(result.page).toBe(3);
    });

    it('rejects invalid status', () => {
      expect(() => ListEmailQueueSchema.parse({ status: 'invalid' })).toThrow();
    });

    it('rejects page < 1', () => {
      expect(() => ListEmailQueueSchema.parse({ page: 0 })).toThrow();
    });
  });

  describe('RetryEmailSchema', () => {
    it('accepts valid emailId', () => {
      const result = RetryEmailSchema.parse({ emailId: 1 });
      expect(result.emailId).toBe(1);
    });

    it('rejects non-positive emailId', () => {
      expect(() => RetryEmailSchema.parse({ emailId: 0 })).toThrow();
      expect(() => RetryEmailSchema.parse({ emailId: -1 })).toThrow();
    });

    it('rejects non-integer emailId', () => {
      expect(() => RetryEmailSchema.parse({ emailId: 1.5 })).toThrow();
    });
  });
});

// ---- Stub Export Tests ----

describe('Email queue server function stubs', () => {
  it('exports listEmailQueue as a function', () => {
    expect(typeof listEmailQueue).toBe('function');
  });

  it('exports retryEmail as a function', () => {
    expect(typeof retryEmail).toBe('function');
  });
});

// ---- listEmailQueueHandler Tests ----

describe('listEmailQueueHandler', () => {
  let mockDb: any;

  const adminSession = {
    user: {
      id: 'admin-1',
      name: 'Admin',
      email: 'admin@test.com',
      role: 'superadmin',
      locale: 'en',
      emailVerified: true,
    },
    session: {} as any,
  };

  const nonAdminSession = {
    user: {
      id: 'student-1',
      name: 'Student',
      email: 'student@test.com',
      role: 'student',
      locale: 'en',
      emailVerified: true,
    },
    session: {} as any,
  };

  const mockEmailEntries = [
    {
      id: 1,
      recipientEmail: 'user@example.com',
      subject: 'Password Reset',
      templateType: 'password_reset',
      status: 'sent',
      attempts: 1,
      lastAttemptAt: new Date('2026-07-19T10:00:00Z'),
      errorMessage: null,
      createdAt: new Date('2026-07-19T09:00:00Z'),
    },
    {
      id: 2,
      recipientEmail: 'failed@example.com',
      subject: 'Invitation',
      templateType: 'invitation',
      status: 'failed',
      attempts: 3,
      lastAttemptAt: new Date('2026-07-19T11:00:00Z'),
      errorMessage: 'SMTP timeout',
      createdAt: new Date('2026-07-19T08:00:00Z'),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      then: vi.fn(function (onfulfilled: any) {
        return Promise.resolve([]).then(onfulfilled);
      }),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  it('returns paginated rows ordered by createdAt DESC for admin', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);

    mockDb.then
      .mockImplementationOnce((onf: any) => Promise.resolve([{ total: 2 }]).then(onf))
      .mockImplementationOnce((onf: any) => Promise.resolve(mockEmailEntries).then(onf))
      .mockImplementationOnce((onf: any) =>
        Promise.resolve([{ pending: 0, sent: 1, failed: 1 }]).then(onf),
      );

    const { listEmailQueueHandler } = await import('@/server/email-queue.server');
    const result = (await listEmailQueueHandler({
      data: { page: 1, status: 'all', search: '' },
    })) as ListEmailQueueSuccess;

    expect(result).not.toHaveProperty('error');
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toEqual({
      id: 1,
      recipientEmail: 'user@example.com',
      subject: 'Password Reset',
      templateType: 'password_reset',
      status: 'sent',
      attempts: 1,
      lastAttemptAt: '2026-07-19T10:00:00.000Z',
      errorMessage: null,
      createdAt: '2026-07-19T09:00:00.000Z',
    });
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(mockDb.orderBy).toHaveBeenCalled();
    expect(mockDb.limit).toHaveBeenCalledWith(20);
    expect(mockDb.offset).toHaveBeenCalledWith(0);
  });

  it('paginates correctly for page > 1', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);

    mockDb.then
      .mockImplementationOnce((onf: any) => Promise.resolve([{ total: 25 }]).then(onf))
      .mockImplementationOnce((onf: any) => Promise.resolve(mockEmailEntries).then(onf))
      .mockImplementationOnce((onf: any) =>
        Promise.resolve([{ pending: 5, sent: 15, failed: 5 }]).then(onf),
      );

    const { listEmailQueueHandler } = await import('@/server/email-queue.server');
    await listEmailQueueHandler({ data: { page: 2, status: 'all', search: '' } });

    expect(mockDb.limit).toHaveBeenCalledWith(20);
    expect(mockDb.offset).toHaveBeenCalledWith(20);
  });

  it('rejects non-admin with UNAUTHORIZED error', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(nonAdminSession as any);

    const { listEmailQueueHandler } = await import('@/server/email-queue.server');
    const result = (await listEmailQueueHandler({
      data: { page: 1, status: 'all', search: '' },
    })) as ServerError;

    expect(result).toHaveProperty('error');
    expect(result.error.code).toBe('UNAUTHORIZED');
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated user with UNAUTHORIZED error', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);

    const { listEmailQueueHandler } = await import('@/server/email-queue.server');
    const result = (await listEmailQueueHandler({
      data: { page: 1, status: 'all', search: '' },
    })) as ServerError;

    expect(result).toHaveProperty('error');
    expect(result.error.code).toBe('UNAUTHORIZED');
  });

  it('filters by status when provided', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);

    mockDb.then
      .mockImplementationOnce((onf: any) => Promise.resolve([{ total: 1 }]).then(onf))
      .mockImplementationOnce((onf: any) => Promise.resolve([mockEmailEntries[1]]).then(onf))
      .mockImplementationOnce((onf: any) =>
        Promise.resolve([{ pending: 0, sent: 1, failed: 1 }]).then(onf),
      );

    const { listEmailQueueHandler } = await import('@/server/email-queue.server');
    const result = (await listEmailQueueHandler({
      data: { page: 1, status: 'failed', search: '' },
    })) as ListEmailQueueSuccess;

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].status).toBe('failed');
    expect(mockDb.where).toHaveBeenCalled();
  });

  it('searches by recipient email OR subject (case-insensitive)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);

    mockDb.then
      .mockImplementationOnce((onf: any) => Promise.resolve([{ total: 1 }]).then(onf))
      .mockImplementationOnce((onf: any) => Promise.resolve([mockEmailEntries[0]]).then(onf))
      .mockImplementationOnce((onf: any) =>
        Promise.resolve([{ pending: 0, sent: 1, failed: 1 }]).then(onf),
      );

    const { listEmailQueueHandler } = await import('@/server/email-queue.server');
    const result = (await listEmailQueueHandler({
      data: { page: 1, status: 'all', search: 'user@example.com' },
    })) as ListEmailQueueSuccess;

    expect(result.entries).toHaveLength(1);
    expect(mockDb.where).toHaveBeenCalled();
  });

  it('returns summary counts (pending/sent/failed) for overall queue', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);

    mockDb.then
      .mockImplementationOnce((onf: any) => Promise.resolve([{ total: 15 }]).then(onf))
      .mockImplementationOnce((onf: any) => Promise.resolve(mockEmailEntries).then(onf))
      .mockImplementationOnce((onf: any) =>
        Promise.resolve([{ pending: 5, sent: 8, failed: 2 }]).then(onf),
      );

    const { listEmailQueueHandler } = await import('@/server/email-queue.server');
    const result = (await listEmailQueueHandler({
      data: { page: 1, status: 'all', search: '' },
    })) as ListEmailQueueSuccess;

    expect(result.summary).toEqual({ pending: 5, sent: 8, failed: 2 });
  });

  it('handles empty results', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);

    mockDb.then
      .mockImplementationOnce((onf: any) => Promise.resolve([{ total: 0 }]).then(onf))
      .mockImplementationOnce((onf: any) => Promise.resolve([]).then(onf))
      .mockImplementationOnce((onf: any) =>
        Promise.resolve([{ pending: 0, sent: 0, failed: 0 }]).then(onf),
      );

    const { listEmailQueueHandler } = await import('@/server/email-queue.server');
    const result = (await listEmailQueueHandler({
      data: { page: 1, status: 'all', search: '' },
    })) as ListEmailQueueSuccess;

    expect(result.entries).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.summary).toEqual({ pending: 0, sent: 0, failed: 0 });
  });

  it('handles DB error with INTERNAL server error', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession as any);

    mockDb.then.mockImplementation(() => {
      throw new Error('DB connection failed');
    });

    const { listEmailQueueHandler } = await import('@/server/email-queue.server');
    const result = (await listEmailQueueHandler({
      data: { page: 1, status: 'all', search: '' },
    })) as ServerError;

    expect(result).toHaveProperty('error');
    expect(result.error.code).toBe('INTERNAL');
  });
});
