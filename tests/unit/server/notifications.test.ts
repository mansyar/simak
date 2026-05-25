/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  CreateNotificationSchema,
  ListNotificationsSchema,
  createNotification,
  listNotifications,
} from '@/server/notifications';

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
