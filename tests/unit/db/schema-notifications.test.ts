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

  it('retains legacy title and message columns during the expand phase', () => {
    const columns = Object.keys(notifications);

    expect(columns).toContain('title');
    expect(columns).toContain('message');
  });
});
