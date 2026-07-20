/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listNotificationsHandler } from '@/server/notifications.server';
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

describe('listNotificationsHandler', () => {
  let mockDb: any;
  const userSession = {
    user: { id: 'user-1', role: 'student' as const, locale: 'en' },
    session: {} as any,
  };

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

  it('should reject if unauthorized', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);

    const result = await listNotificationsHandler({ data: { page: 1, limit: 20 } });
    expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  });

  it('should return paginated notifications with metadata', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(userSession as any);
    // Mock returns all columns (as db.select() would before narrowing)
    const items = [
      {
        id: 1,
        userId: 'user-1',
        type: 'test',
        titleKey: '',
        messageKey: '',
        params: null,
        read: false,
        channel: 'in_app',
        metadata: { foo: 'bar' },
        createdAt: new Date('2024-01-01'),
      },
      {
        id: 2,
        userId: 'user-1',
        type: 'test',
        titleKey: '',
        messageKey: '',
        params: null,
        read: false,
        channel: 'in_app',
        metadata: null,
        createdAt: new Date('2024-01-02'),
      },
    ];
    mockDb.then
      .mockImplementationOnce((fn: any) => Promise.resolve([{ count: 2 }]).then(fn))
      .mockImplementationOnce((fn: any) => Promise.resolve(items).then(fn));

    const result = (await listNotificationsHandler({ data: { page: 1, limit: 20 } })) as any;
    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
    // Response should include metadata for notification navigation (TRACK-012)
    expect(result.items[0]).toEqual({
      id: 1,
      type: 'test',
      titleKey: '',
      messageKey: '',
      params: null,
      read: false,
      metadata: { foo: 'bar' },
      createdAt: new Date('2024-01-01'),
    });
    expect(result.items[0]).not.toHaveProperty('userId');
    expect(result.items[0]).not.toHaveProperty('channel');
    // Null metadata should be preserved
    expect(result.items[1]).toHaveProperty('metadata', null);
  });

  it('should filter by notification type', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(userSession as any);
    const items = [
      {
        id: 1,
        userId: 'user-1',
        type: 'sla_breach',
        titleKey: '',
        messageKey: '',
        params: null,
        read: false,
        channel: 'in_app',
        metadata: null,
        createdAt: new Date('2024-01-01'),
      },
    ];
    mockDb.then
      .mockImplementationOnce((fn: any) => Promise.resolve([{ count: 1 }]).then(fn))
      .mockImplementationOnce((fn: any) => Promise.resolve(items).then(fn));

    const result = (await listNotificationsHandler({
      data: { page: 1, limit: 20, type: 'sla_breach' },
    })) as any;
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toHaveProperty('metadata');
    expect(result.items[0]).not.toHaveProperty('channel');
    expect(result.items[0]).not.toHaveProperty('userId');
  });

  it('should handle empty results', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(userSession as any);
    mockDb.then
      .mockImplementationOnce((fn: any) => Promise.resolve([{ count: 0 }]).then(fn))
      .mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn));

    const result = await listNotificationsHandler({ data: { page: 1, limit: 20 } });
    expect(result).toEqual({ items: [], total: 0 });
  });

  it('should include metadata but not channel or userId in response (TRACK-012)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(userSession as any);
    // Mock returns items WITH metadata and channel (simulating old db.select() *)
    const items = [
      {
        id: 1,
        userId: 'user-1',
        type: 'test',
        titleKey: '',
        messageKey: '',
        params: { key: 'value' },
        read: true,
        channel: 'in_app',
        metadata: { checkpointId: 5, assignmentId: 3 },
        createdAt: new Date('2024-06-15'),
      },
    ];
    mockDb.then
      .mockImplementationOnce((fn: any) => Promise.resolve([{ count: 1 }]).then(fn))
      .mockImplementationOnce((fn: any) => Promise.resolve(items).then(fn));

    const result = (await listNotificationsHandler({ data: { page: 1, limit: 20 } })) as any;
    // metadata IS included for notification navigation (TRACK-012)
    expect(result.items[0]).toHaveProperty('metadata');
    expect(result.items[0].metadata).toEqual({ checkpointId: 5, assignmentId: 3 });
    expect(result.items[0]).not.toHaveProperty('channel');
    expect(result.items[0]).not.toHaveProperty('userId');
    // Should still have the needed columns
    expect(result.items[0]).toHaveProperty('id');
    expect(result.items[0]).toHaveProperty('type');
    expect(result.items[0]).toHaveProperty('titleKey');
    expect(result.items[0]).toHaveProperty('messageKey');
    expect(result.items[0]).toHaveProperty('params');
    expect(result.items[0]).toHaveProperty('read');
    expect(result.items[0]).toHaveProperty('createdAt');
  });

  it('should handle database error gracefully', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(userSession as any);
    mockDb.select.mockImplementationOnce(() => {
      throw new Error('DB error');
    });

    const result = await listNotificationsHandler({ data: { page: 1, limit: 20 } });
    expect(result).toEqual({ error: { code: 'INTERNAL', message: 'Internal Server Error' } });
  });

  it('should use session.user.locale instead of redundant locale query (PERF-24)', async () => {
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue({
      user: { id: 'user-1', role: 'student' as const, locale: 'id' },
      session: {} as any,
    } as any);
    mockDb.then
      .mockImplementationOnce((fn: any) => Promise.resolve([{ count: 1 }]).then(fn))
      .mockImplementationOnce((fn: any) =>
        Promise.resolve([
          {
            id: 1,
            type: 'test',
            titleKey: '',
            messageKey: '',
            params: null,
            read: false,
            createdAt: new Date('2024-01-01'),
          },
        ]).then(fn),
      );

    const result = (await listNotificationsHandler({ data: { page: 1, limit: 20 } })) as any;
    // Should only make 2 DB queries (count + data), NOT 3 (no locale query)
    expect(mockDb.then).toHaveBeenCalledTimes(2);
    expect(result.total).toBe(1);
  });
});
