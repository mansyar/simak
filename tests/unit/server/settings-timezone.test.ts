/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCurrentUserHandler, updateUserSettingsHandler } from '@/server/settings.server';
import { UpdateUserSettingsSchema } from '@/server/settings';
import { resolveTimeZone } from '@/lib/timezone';
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
    middleware: vi.fn().mockReturnThis(),
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
  createMiddleware: vi.fn().mockReturnValue({
    server: vi.fn().mockImplementation((fn) => fn),
  }),
}));

const mockSession = {
  user: {
    id: 'student-1',
    role: 'student' as const,
    name: 'Student',
    email: 'student@example.com',
    image: null,
  },
  session: {},
};

const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  returning: vi.fn(),
  then: vi.fn(),
};

function resolveWith<T>(value: T) {
  mockDb.then.mockImplementationOnce((onfulfilled: (result: T) => unknown) =>
    Promise.resolve(value).then(onfulfilled),
  );
}

function resolveReturning<T>(value: T) {
  mockDb.returning.mockReturnValueOnce({
    then: (onfulfilled: (result: T) => unknown) => Promise.resolve(value).then(onfulfilled),
  });
}

describe('timezone settings contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as never);
  });

  describe('UpdateUserSettingsSchema', () => {
    it('accepts a supported IANA timezone', () => {
      expect(UpdateUserSettingsSchema.safeParse({ timezone: 'Asia/Jakarta' }).success).toBe(true);
    });

    it('rejects an unsupported timezone', () => {
      expect(UpdateUserSettingsSchema.safeParse({ timezone: 'Mars/Phobos' }).success).toBe(false);
    });
  });

  it('prefers a valid saved timezone and falls back to UTC for invalid values', () => {
    expect(resolveTimeZone('America/New_York', 'Asia/Jakarta')).toBe('America/New_York');
    expect(resolveTimeZone('Mars/Phobos')).toBe('UTC');
  });

  describe('updateUserSettingsHandler', () => {
    it('rejects unauthenticated updates', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);

      await expect(
        updateUserSettingsHandler({ data: { timezone: 'Asia/Jakarta' } }),
      ).resolves.toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('preserves existing settings while saving a timezone', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as never);
      const existingSettings = {
        reducedMotion: true,
        timezone: 'UTC',
        notificationPrefs: { deadline_reminder: { email: false, inApp: true } },
      };
      const expectedSettings = { ...existingSettings, timezone: 'Asia/Jakarta' };
      resolveWith([{ settings: existingSettings }]);
      resolveReturning([{ settings: expectedSettings }]);

      await expect(
        updateUserSettingsHandler({ data: { timezone: 'Asia/Jakarta' } }),
      ).resolves.toEqual(expectedSettings);
      expect(mockDb.set).toHaveBeenCalledWith({ settings: expectedSettings });
    });

    it('does not write deadline or reminder fields while updating settings', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as never);
      const existingSettings = {
        reducedMotion: false,
        notificationPrefs: { deadline_reminder: { email: false } },
      };
      const expectedSettings = { ...existingSettings, timezone: 'UTC' };
      resolveWith([{ settings: existingSettings }]);
      resolveReturning([{ settings: expectedSettings }]);

      await updateUserSettingsHandler({ data: { timezone: 'UTC' } });

      expect(mockDb.update).toHaveBeenCalledTimes(1);
      expect(mockDb.set).toHaveBeenCalledWith({ settings: expectedSettings });
      expect(mockDb.set.mock.calls[0][0]).not.toHaveProperty('dueDate');
    });
  });

  describe('getCurrentUserHandler', () => {
    it('does not expose an invalid persisted timezone to the settings UI', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as never);
      resolveWith([
        {
          name: 'Student',
          email: 'student@example.com',
          image: null,
          settings: { reducedMotion: false, timezone: 'Mars/Phobos' },
        },
      ]);

      await expect(getCurrentUserHandler()).resolves.toEqual({
        user: {
          id: 'student-1',
          name: 'Student',
          email: 'student@example.com',
          image: null,
        },
        settings: { reducedMotion: false },
      });
    });
  });
});
