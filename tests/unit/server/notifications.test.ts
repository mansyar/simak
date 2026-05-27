/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CreateNotificationSchema,
  ListNotificationsSchema,
  MarkReadSchema,
  MarkAllReadSchema,
  GetUnreadCountSchema,
  createNotification,
  listNotifications,
} from '@/server/notifications';
import {
  createNotificationHandler,
  listNotificationsHandler,
  markReadHandler,
  markAllReadHandler,
  getUnreadCountHandler,
} from '@/server/notifications.server';
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
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

// Schema validation tests
describe('Notification schemas', () => {
  describe('CreateNotificationSchema', () => {
    it('should accept valid notification creation data', () => {
      const result = CreateNotificationSchema.safeParse({
        userId: 'user-1',
        type: 'sla_breach',
        title: 'SLA Breach',
        message: 'Review overdue',
        channel: 'in_app',
        metadata: { assignmentId: 1, breachDays: 3 },
      });
      expect(result.success).toBe(true);
    });

    it('should accept notification without optional metadata', () => {
      const result = CreateNotificationSchema.safeParse({
        userId: 'user-1',
        type: 'sla_breach',
        title: 'SLA Breach',
        channel: 'in_app',
      });
      expect(result.success).toBe(true);
    });

    it('should reject notification with invalid channel', () => {
      const result = CreateNotificationSchema.safeParse({
        userId: 'user-1',
        type: 'sla_breach',
        title: 'SLA Breach',
        channel: 'sms',
      });
      expect(result.success).toBe(false);
    });

    it('should reject notification without required fields', () => {
      const result = CreateNotificationSchema.safeParse({
        userId: 'user-1',
        type: 'sla_breach',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty userId', () => {
      const result = CreateNotificationSchema.safeParse({
        userId: '',
        type: 'sla_breach',
        title: 'Test',
        channel: 'in_app',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ListNotificationsSchema', () => {
    it('should accept valid list params', () => {
      const result = ListNotificationsSchema.safeParse({
        page: 1,
        limit: 20,
        type: 'sla_breach',
      });
      expect(result.success).toBe(true);
    });

    it('should accept list params without type filter', () => {
      const result = ListNotificationsSchema.safeParse({
        page: 1,
        limit: 20,
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid page number', () => {
      const result = ListNotificationsSchema.safeParse({
        page: 0,
        limit: 20,
      });
      expect(result.success).toBe(false);
    });

    it('should reject limit over 100', () => {
      const result = ListNotificationsSchema.safeParse({
        page: 1,
        limit: 200,
      });
      expect(result.success).toBe(false);
    });
  });
});

// Server function stub tests
describe('Notification server function stubs', () => {
  it('should export createNotification as a function', () => {
    expect(typeof createNotification).toBe('function');
  });

  it('should export listNotifications as a function', () => {
    expect(typeof listNotifications).toBe('function');
  });
});

// New schema tests for Phase 1
describe('New notification schemas', () => {
  describe('MarkReadSchema', () => {
    it('should accept valid notification ID', () => {
      const result = MarkReadSchema.safeParse({ notificationId: 1 });
      expect(result.success).toBe(true);
    });

    it('should reject non-numeric notificationId', () => {
      const result = MarkReadSchema.safeParse({ notificationId: 'abc' });
      expect(result.success).toBe(false);
    });

    it('should reject negative notificationId', () => {
      const result = MarkReadSchema.safeParse({ notificationId: -1 });
      expect(result.success).toBe(false);
    });
  });

  describe('MarkAllReadSchema', () => {
    it('should accept empty input', () => {
      const result = MarkAllReadSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('GetUnreadCountSchema', () => {
    it('should accept empty input', () => {
      const result = GetUnreadCountSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});

// Handler tests for Phase 1
describe('Notification handlers', () => {
  let mockDb: any;
  const userSession = {
    user: { id: 'user-1', role: 'student' as const },
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
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      then: vi.fn(function (onfulfilled: any) {
        return Promise.resolve([]).then(onfulfilled);
      }),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  describe('createNotificationHandler', () => {
    it('should reject if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);

      const result = await createNotificationHandler({
        data: { userId: 'user-1', type: 'test', title: 'Test', channel: 'in_app' as const },
      });
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should create a notification and return it', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(userSession as any);
      const created = { id: 1, userId: 'user-1', type: 'test', title: 'Test', channel: 'in_app' };
      mockDb.returning.mockResolvedValue([created]);

      const result = await createNotificationHandler({
        data: { userId: 'user-1', type: 'test', title: 'Test', channel: 'in_app' as const },
      });
      expect(result).toEqual({ notification: created });
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalled();
    });

    it('should handle database error gracefully', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(userSession as any);
      mockDb.returning.mockRejectedValue(new Error('DB error'));

      const result = await createNotificationHandler({
        data: { userId: 'user-1', type: 'test', title: 'Test', channel: 'in_app' as const },
      });
      expect(result).toEqual({ error: 'Internal Server Error' });
    });
  });

  describe('listNotificationsHandler', () => {
    it('should reject if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);

      const result = await listNotificationsHandler({ data: { page: 1, limit: 20 } });
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should return paginated notifications', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(userSession as any);
      const items = [
        { id: 1, userId: 'user-1', type: 'test', title: 'Test 1', channel: 'in_app' },
        { id: 2, userId: 'user-1', type: 'test', title: 'Test 2', channel: 'in_app' },
      ];
      mockDb.then
        .mockImplementationOnce((fn: any) => Promise.resolve([{ count: 2 }]).then(fn))
        .mockImplementationOnce((fn: any) => Promise.resolve(items).then(fn));

      const result = await listNotificationsHandler({ data: { page: 1, limit: 20 } });
      expect(result).toEqual({ items, total: 2 });
    });

    it('should filter by notification type', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(userSession as any);
      const items = [
        { id: 1, userId: 'user-1', type: 'sla_breach', title: 'SLA', channel: 'in_app' },
      ];
      mockDb.then
        .mockImplementationOnce((fn: any) => Promise.resolve([{ count: 1 }]).then(fn))
        .mockImplementationOnce((fn: any) => Promise.resolve(items).then(fn));

      const result = await listNotificationsHandler({
        data: { page: 1, limit: 20, type: 'sla_breach' },
      });
      expect(result).toEqual({ items, total: 1 });
    });

    it('should handle empty results', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(userSession as any);
      mockDb.then
        .mockImplementationOnce((fn: any) => Promise.resolve([{ count: 0 }]).then(fn))
        .mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn));

      const result = await listNotificationsHandler({ data: { page: 1, limit: 20 } });
      expect(result).toEqual({ items: [], total: 0 });
    });

    it('should handle database error gracefully', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(userSession as any);
      mockDb.select.mockImplementationOnce(() => { throw new Error('DB error'); });

      const result = await listNotificationsHandler({ data: { page: 1, limit: 20 } });
      expect(result).toEqual({ error: 'Internal Server Error' });
    });
  });
  describe('markReadHandler', () => {
    it('should reject if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);

      const result = await markReadHandler({ data: { notificationId: 1 } });
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should mark a notification as read if owned by user', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(userSession as any);
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ id: 1, userId: 'user-1', read: false }]).then(onfulfilled),
      );
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ id: 1, userId: 'user-1', read: true }]).then(onfulfilled),
      );

      const result = await markReadHandler({ data: { notificationId: 1 } });
      expect(result).toEqual({ success: true });
    });

    it('should reject if notification not found', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(userSession as any);
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );

      const result = await markReadHandler({ data: { notificationId: 999 } });
      expect(result).toEqual({ error: 'Notification not found' });
    });

    it('should reject if notification belongs to another user', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(userSession as any);
      // Mock simulates DB where clause filtering: notification exists but belongs to different user
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );

      const result = await markReadHandler({ data: { notificationId: 1 } });
      expect(result).toEqual({ error: 'Notification not found' });
    });

    it('should handle database error gracefully', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(userSession as any);
      mockDb.select.mockImplementationOnce(() => { throw new Error('DB error'); });

      const result = await markReadHandler({ data: { notificationId: 1 } });
      expect(result).toEqual({ error: 'Internal Server Error' });
    });
  });

  describe('markAllReadHandler', () => {
    it('should reject if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);

      const result = await markAllReadHandler({ data: {} });
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should mark all unread notifications as read for current user', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(userSession as any);
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 5 }]).then(onfulfilled),
      );

      const result = await markAllReadHandler({ data: {} });
      expect(result).toEqual({ success: true });
    });

    it('should succeed even if no unread notifications exist', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(userSession as any);
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 0 }]).then(onfulfilled),
      );

      const result = await markAllReadHandler({ data: {} });
      expect(result).toEqual({ success: true });
    });

    it('should handle database error gracefully', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(userSession as any);
      mockDb.update.mockImplementationOnce(() => { throw new Error('DB error'); });

      const result = await markAllReadHandler({ data: {} });
      expect(result).toEqual({ error: 'Internal Server Error' });
    });
  });

  describe('getUnreadCountHandler', () => {
    it('should reject if unauthorized', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);

      const result = await getUnreadCountHandler({ data: {} });
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should return unread count for current user', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(userSession as any);
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 3 }]).then(onfulfilled),
      );

      const result = await getUnreadCountHandler({ data: {} });
      expect(result).toEqual({ count: 3 });
    });

    it('should return zero when no unread notifications', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(userSession as any);
      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ count: 0 }]).then(onfulfilled),
      );

      const result = await getUnreadCountHandler({ data: {} });
      expect(result).toEqual({ count: 0 });
    });

    it('should handle database error gracefully', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(userSession as any);
      mockDb.select.mockImplementationOnce(() => { throw new Error('DB error'); });

      const result = await getUnreadCountHandler({ data: {} });
      expect(result).toEqual({ error: 'Internal Server Error' });
    });
  });
});
