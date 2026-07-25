import { describe, it, expect } from 'vitest';
import { shouldSendInAppNotification } from '@/lib/notification-prefs';

describe('shouldSendInAppNotification (TRACK-022)', () => {
  it('returns false when inApp is explicitly false', () => {
    const settings = {
      reducedMotion: false,
      notificationPrefs: { review_completed: { inApp: false } },
    };
    expect(shouldSendInAppNotification(settings, 'review_completed')).toBe(false);
  });

  it('returns true when inApp is explicitly true', () => {
    const settings = {
      reducedMotion: false,
      notificationPrefs: { review_completed: { inApp: true } },
    };
    expect(shouldSendInAppNotification(settings, 'review_completed')).toBe(true);
  });

  it('returns true when type key is absent from notificationPrefs', () => {
    const settings = {
      reducedMotion: false,
      notificationPrefs: { other_type: { inApp: false } },
    };
    expect(shouldSendInAppNotification(settings, 'review_completed')).toBe(true);
  });

  it('returns true when notificationPrefs is absent', () => {
    const settings = { reducedMotion: false };
    expect(shouldSendInAppNotification(settings, 'review_completed')).toBe(true);
  });

  it('returns true when settings is null', () => {
    expect(shouldSendInAppNotification(null, 'review_completed')).toBe(true);
  });

  it('returns true when settings is undefined', () => {
    expect(shouldSendInAppNotification(undefined, 'review_completed')).toBe(true);
  });

  it('returns true when inApp is undefined (only email set)', () => {
    const settings = {
      reducedMotion: false,
      notificationPrefs: { review_completed: { email: false } },
    };
    expect(shouldSendInAppNotification(settings, 'review_completed')).toBe(true);
  });

  it('returns true when type pref is empty object', () => {
    const settings = {
      reducedMotion: false,
      notificationPrefs: { review_completed: {} },
    };
    expect(shouldSendInAppNotification(settings, 'review_completed')).toBe(true);
  });
});
