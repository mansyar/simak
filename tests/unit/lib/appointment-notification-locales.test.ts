import { describe, expect, it } from 'vitest';
import en from '../../../locales/en.json';
import id from '../../../locales/id.json';
import { getNotificationKeys, resolveNotificationContent } from '@/lib/i18n-server';

const appointmentEvents = [
  'appointment_booked',
  'appointment_cancelled',
  'appointment_rescheduled',
  'appointment_completed',
  'appointment_no_show',
  'appointment_reminder_24h',
  'appointment_reminder_1h',
] as const;

const appointmentEmailSubjects = [
  'appointmentBooked',
  'appointmentCancelled',
  'appointmentRescheduled',
  'appointmentCompleted',
  'appointmentNoShow',
  'appointmentReminder',
] as const;

function readKey(source: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((value, part) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[part];
  }, source);
}

describe('appointment notification locale contracts', () => {
  it('defines every lifecycle and reminder event in both locales', () => {
    for (const event of appointmentEvents) {
      const { titleKey, messageKey } = getNotificationKeys(event);

      expect(readKey(en, titleKey), `missing English title: ${event}`).toBeTypeOf('string');
      expect(readKey(en, messageKey), `missing English message: ${event}`).toBeTypeOf('string');
      expect(readKey(id, titleKey), `missing Indonesian title: ${event}`).toBeTypeOf('string');
      expect(readKey(id, messageKey), `missing Indonesian message: ${event}`).toBeTypeOf('string');
    }
  });

  it('defines appointment email subjects in both locales', () => {
    for (const subject of appointmentEmailSubjects) {
      const key = `emails.subjects.${subject}`;
      expect(readKey(en, key), `missing English subject: ${subject}`).toBeTypeOf('string');
      expect(readKey(id, key), `missing Indonesian subject: ${subject}`).toBeTypeOf('string');
    }
  });

  it('resolves localized appointment content with UTC-safe parameters', () => {
    const { titleKey, messageKey } = getNotificationKeys('appointment_booked');
    const params = {
      appointmentId: '42',
      assignmentId: '7',
      startAt: '2026-08-08T09:00:00.000Z',
      endAt: '2026-08-08T09:30:00.000Z',
    };

    for (const locale of ['en', 'id'] as const) {
      const content = resolveNotificationContent(titleKey, messageKey, params, locale);
      expect(content.title).not.toBe(titleKey);
      expect(content.message).not.toBe(messageKey);
      expect(content.message).toContain('42');
      expect(content.message).toContain('2026-08-08T09:00:00.000Z');
    }
  });
});
