/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { notifications } from '@/db/schema/notifications';

describe('notifications schema', () => {
  it('has titleKey, messageKey, and params columns for i18n support', () => {
    const columns = Object.keys(notifications);

    expect(columns).toContain('titleKey');
    expect(columns).toContain('messageKey');
    expect(columns).toContain('params');
  });

  it('drops legacy title and message columns in the contract phase', () => {
    const columns = Object.keys(notifications);

    expect(columns).not.toContain('title');
    expect(columns).not.toContain('message');
  });

  it('makes titleKey and messageKey non-nullable after backfill', () => {
    expect(notifications.titleKey.notNull).toBe(true);
    expect(notifications.messageKey.notNull).toBe(true);
  });
});
