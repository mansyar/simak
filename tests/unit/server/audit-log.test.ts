/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ListAuditLogsSchema,
  GetAuditLogDetailSchema,
  listAuditLogs,
  getAuditLogDetail,
} from '@/server/audit-log';
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
    middleware: vi.fn().mockReturnThis(),
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
  createMiddleware: vi.fn().mockReturnValue({
    server: vi.fn().mockImplementation((fn) => fn),
  }),
}));

// Schema validation tests
describe('Audit log schemas', () => {
  describe('ListAuditLogsSchema', () => {
    it('should accept valid input with all fields', () => {
      const result = ListAuditLogsSchema.safeParse({
        page: 1,
        limit: 20,
        action: 'user.created',
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
        search: 'admin',
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty input with defaults', () => {
      const result = ListAuditLogsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(50);
      }
    });

    it('should reject negative page number', () => {
      const result = ListAuditLogsSchema.safeParse({ page: -1 });
      expect(result.success).toBe(false);
    });

    it('should reject limit over 100', () => {
      const result = ListAuditLogsSchema.safeParse({ limit: 200 });
      expect(result.success).toBe(false);
    });
  });

  describe('GetAuditLogDetailSchema', () => {
    it('should accept valid id', () => {
      const result = GetAuditLogDetailSchema.safeParse({ id: 42 });
      expect(result.success).toBe(true);
    });

    it('should reject missing id', () => {
      const result = GetAuditLogDetailSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject non-integer id', () => {
      const result = GetAuditLogDetailSchema.safeParse({ id: 'abc' });
      expect(result.success).toBe(false);
    });
  });
});

// Server function stub tests
describe('Audit log server function stubs', () => {
  it('should export listAuditLogs as a function', () => {
    expect(typeof listAuditLogs).toBe('function');
  });

  it('should export getAuditLogDetail as a function', () => {
    expect(typeof getAuditLogDetail).toBe('function');
  });
});

// Handler tests
describe('Audit log handlers', () => {
  let mockDb: any;

  const mockAuditEntries = [
    {
      id: 1,
      actorId: 'admin-1',
      actorName: 'Admin',
      action: 'user.created',
      entityType: 'user',
      entityId: 'student-1',
      details: { role: 'student', email: 'student@test.com' },
      createdAt: new Date('2026-05-28T10:00:00Z'),
    },
    {
      id: 2,
      actorId: 'admin-1',
      actorName: 'Admin',
      action: 'template.created',
      entityType: 'template',
      entityId: '42',
      details: { name: 'Thesis Template', type: 'Thesis', checkpointCount: 3 },
      createdAt: new Date('2026-05-28T11:00:00Z'),
    },
    {
      id: 3,
      actorId: 'instructor-1',
      actorName: 'Dr. Smith',
      action: 'review.passed',
      entityType: 'review',
      entityId: '99',
      details: { checkpointName: 'Chapter 1', comment: 'Good work' },
      createdAt: new Date('2026-05-28T12:00:00Z'),
    },
  ];

  const adminSession = {
    user: {
      id: 'admin-1',
      name: 'Admin',
      email: 'admin@test.com',
      role: 'superadmin' as const,
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
      role: 'student' as const,
      locale: 'en',
      emailVerified: true,
    },
    session: {} as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      then: vi.fn(function (onfulfilled: any) {
        return Promise.resolve(mockAuditEntries).then(onfulfilled);
      }),
    };

    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  describe('listAuditLogs', () => {
    it('should return paginated audit log entries for admin', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);

      const { listAuditLogsHandler } = await import('@/server/audit-log.server');
      const result = (await listAuditLogsHandler({
        data: { page: 1, limit: 20, action: '', dateFrom: '', dateTo: '', search: '' },
      })) as { entries: unknown[]; total: number };

      expect(result).toBeDefined();
      expect(result.entries).toBeDefined();
      expect(result.total).toBeDefined();
    });

    it('should throw for non-admin users', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(nonAdminSession);

      const { listAuditLogsHandler } = await import('@/server/audit-log.server');
      const result = await listAuditLogsHandler({
        data: { page: 1, limit: 20, action: '', dateFrom: '', dateTo: '', search: '' },
      });

      expect(result).toEqual({
        error: { code: 'FORBIDDEN', message: 'Forbidden: Admin role required' },
      });
    });

    it('should filter by action type', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);
      mockDb.then = vi.fn(function (onfulfilled: any) {
        return Promise.resolve(mockAuditEntries.filter((e) => e.action === 'user.created')).then(
          onfulfilled,
        );
      });

      const { listAuditLogsHandler } = await import('@/server/audit-log.server');
      const result = (await listAuditLogsHandler({
        data: { page: 1, limit: 20, action: 'user.created', dateFrom: '', dateTo: '', search: '' },
      })) as { entries: { action: string }[] };

      expect(result.entries.every((e) => e.action === 'user.created')).toBe(true);
    });

    it('should handle empty results', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);
      mockDb.then = vi.fn(function (onfulfilled: any) {
        return Promise.resolve([]).then(onfulfilled);
      });

      const { listAuditLogsHandler } = await import('@/server/audit-log.server');
      const result = (await listAuditLogsHandler({
        data: { page: 1, limit: 20, action: '', dateFrom: '', dateTo: '', search: '' },
      })) as { entries: unknown[]; total: number };

      expect(result.entries).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getAuditLogDetail', () => {
    it('should return a single audit entry for admin', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(adminSession);

      const { getAuditLogDetailHandler } = await import('@/server/audit-log.server');
      const result = (await getAuditLogDetailHandler({ data: { id: 1 } })) as { id: unknown };

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });

    it('should throw for non-admin users', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(nonAdminSession);

      const { getAuditLogDetailHandler } = await import('@/server/audit-log.server');
      const result = await getAuditLogDetailHandler({ data: { id: 1 } });

      expect(result).toEqual({
        error: { code: 'FORBIDDEN', message: 'Forbidden: Admin role required' },
      });
    });
  });
});
