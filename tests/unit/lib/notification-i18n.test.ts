/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import en from '../../../locales/en.json';
import id from '../../../locales/id.json';

const NOTIFICATION_TYPES = [
  'review_completed',
  'revision_requested',
  'consultation_logged',
  'consultation_verified',
  'consultation_rejected',
  'extension_approved',
  'extension_rejected',
  'deadline_extended',
  'submission_received',
  'extension_requested',
  'sla_breach',
] as const;

function getKey(obj: Record<string, unknown>, key: string): unknown {
  const parts = key.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current !== null && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

describe('Notification i18n keys', () => {
  describe.each(NOTIFICATION_TYPES)('%s', (type) => {
    it(`has title and message keys in en.json`, () => {
      const title = getKey(en, `notifications.events.${type}.title`);
      const message = getKey(en, `notifications.events.${type}.message`);
      expect(typeof title).toBe('string');
      expect(title).not.toBe('');
      expect(typeof message).toBe('string');
      expect(message).not.toBe('');
    });

    it(`has title and message keys in id.json`, () => {
      const title = getKey(id, `notifications.events.${type}.title`);
      const message = getKey(id, `notifications.events.${type}.message`);
      expect(typeof title).toBe('string');
      expect(title).not.toBe('');
      expect(typeof message).toBe('string');
      expect(message).not.toBe('');
    });
  });
});
