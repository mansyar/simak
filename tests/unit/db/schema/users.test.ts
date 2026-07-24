import { describe, it, expect, expectTypeOf } from 'vitest';
import type { InferSelectModel } from 'drizzle-orm';

type UserRow = InferSelectModel<typeof import('@/db/schema/users').users>;
type Settings = NonNullable<UserRow['settings']>;

describe('Users schema — settings type extension (TRACK-022)', () => {
  it('should have a settings column of jsonb type', async () => {
    const { users } = await import('@/db/schema/users');
    expect(users).toHaveProperty('settings');
    expect(users.settings.dataType).toBe('json');
  });

  it('settings type should include reducedMotion as a required boolean', () => {
    expectTypeOf<Settings['reducedMotion']>().toEqualTypeOf<boolean>();
  });

  it('settings type should include optional notificationPrefs field', () => {
    // notificationPrefs is optional — undefined is assignable
    const prefs: Settings['notificationPrefs'] = undefined;
    expectTypeOf(prefs).toMatchTypeOf<
      Record<string, { email?: boolean; inApp?: boolean }> | undefined
    >();
  });

  it('notificationPrefs should accept a valid preference record', () => {
    const prefs: NonNullable<Settings['notificationPrefs']> = {
      submission_received: { email: false, inApp: true },
      review_completed: { email: true },
      consultation_rejected: { inApp: false },
      sla_breach: {},
    };
    expect(prefs).toBeDefined();
  });

  it('notificationPrefs should default to undefined when not set', () => {
    const settings: Settings = { reducedMotion: false };
    expect(settings.notificationPrefs).toBeUndefined();
  });
});
