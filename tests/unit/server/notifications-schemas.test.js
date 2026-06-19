/** @vitest-environment node */
import { describe, it, expect, vi } from 'vitest';
// Mock createServerFn before importing
vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));
import {
  CreateNotificationSchema,
  ListNotificationsSchema,
  MarkReadSchema,
  MarkAllReadSchema,
  GetUnreadCountSchema,
} from '@/server/notifications';
describe('Notification Schemas', () => {
  describe('CreateNotificationSchema', () => {
    it('should accept valid in-app notification', () => {
      const result = CreateNotificationSchema.safeParse({
        userId: 'user-123',
        type: 'assignment_created',
        title: 'New Assignment',
        message: 'You have a new assignment',
        channel: 'in_app',
      });
      expect(result.success).toBe(true);
    });
    it('should accept valid email notification', () => {
      const result = CreateNotificationSchema.safeParse({
        userId: 'user-123',
        type: 'sla_breach',
        title: 'SLA Breach',
        channel: 'email',
        metadata: { assignmentId: 1 },
      });
      expect(result.success).toBe(true);
    });
    it('should reject invalid channel', () => {
      const result = CreateNotificationSchema.safeParse({
        userId: 'user-123',
        type: 'test',
        title: 'Test',
        channel: 'invalid',
      });
      expect(result.success).toBe(false);
    });
    it('should reject empty userId', () => {
      const result = CreateNotificationSchema.safeParse({
        userId: '',
        type: 'test',
        title: 'Test',
        channel: 'in_app',
      });
      expect(result.success).toBe(false);
    });
    it('should reject empty type', () => {
      const result = CreateNotificationSchema.safeParse({
        userId: 'user-123',
        type: '',
        title: 'Test',
        channel: 'in_app',
      });
      expect(result.success).toBe(false);
    });
    it('should reject empty title', () => {
      const result = CreateNotificationSchema.safeParse({
        userId: 'user-123',
        type: 'test',
        title: '',
        channel: 'in_app',
      });
      expect(result.success).toBe(false);
    });
    it('should accept optional message', () => {
      const result = CreateNotificationSchema.safeParse({
        userId: 'user-123',
        type: 'test',
        title: 'Test',
        channel: 'in_app',
      });
      expect(result.success).toBe(true);
    });
    it('should accept optional metadata', () => {
      const result = CreateNotificationSchema.safeParse({
        userId: 'user-123',
        type: 'test',
        title: 'Test',
        channel: 'in_app',
        metadata: { key: 'value' },
      });
      expect(result.success).toBe(true);
    });
  });
  describe('ListNotificationsSchema', () => {
    it('should accept empty input with defaults', () => {
      const result = ListNotificationsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
        expect(result.data.type).toBeUndefined();
      }
    });
    it('should accept custom pagination', () => {
      const result = ListNotificationsSchema.safeParse({
        page: 2,
        limit: 50,
        type: 'sla_breach',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(50);
        expect(result.data.type).toBe('sla_breach');
      }
    });
    it('should reject page less than 1', () => {
      const result = ListNotificationsSchema.safeParse({ page: 0 });
      expect(result.success).toBe(false);
    });
    it('should reject limit greater than 100', () => {
      const result = ListNotificationsSchema.safeParse({ limit: 101 });
      expect(result.success).toBe(false);
    });
  });
  describe('MarkReadSchema', () => {
    it('should accept valid notificationId', () => {
      const result = MarkReadSchema.safeParse({ notificationId: 1 });
      expect(result.success).toBe(true);
    });
    it('should reject missing notificationId', () => {
      const result = MarkReadSchema.safeParse({});
      expect(result.success).toBe(false);
    });
    it('should reject zero notificationId', () => {
      const result = MarkReadSchema.safeParse({ notificationId: 0 });
      expect(result.success).toBe(false);
    });
  });
  describe('MarkAllReadSchema', () => {
    it('should accept empty object', () => {
      const result = MarkAllReadSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
  describe('GetUnreadCountSchema', () => {
    it('should accept empty object', () => {
      const result = GetUnreadCountSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
  describe('Server Function Stubs', () => {
    it('should export createNotification function', async () => {
      const { createNotification } = await import('@/server/notifications');
      expect(createNotification).toBeDefined();
      expect(typeof createNotification).toBe('function');
    });
    it('should export listNotifications function', async () => {
      const { listNotifications } = await import('@/server/notifications');
      expect(listNotifications).toBeDefined();
      expect(typeof listNotifications).toBe('function');
    });
    it('should export markRead function', async () => {
      const { markRead } = await import('@/server/notifications');
      expect(markRead).toBeDefined();
      expect(typeof markRead).toBe('function');
    });
    it('should export markAllRead function', async () => {
      const { markAllRead } = await import('@/server/notifications');
      expect(markAllRead).toBeDefined();
      expect(typeof markAllRead).toBe('function');
    });
    it('should export getUnreadCount function', async () => {
      const { getUnreadCount } = await import('@/server/notifications');
      expect(getUnreadCount).toBeDefined();
      expect(typeof getUnreadCount).toBe('function');
    });
  });
});
