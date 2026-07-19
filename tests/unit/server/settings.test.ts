/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  UpdateProfileSchema,
  UpdateUserSettingsSchema,
  GetPresignedAvatarUploadUrlSchema,
  updateProfile,
  updateUserSettings,
  getPresignedAvatarUploadUrl,
  getCurrentUser,
} from '@/server/settings';
import {
  updateProfileHandler,
  updateUserSettingsHandler,
  getPresignedAvatarUploadUrlHandler,
  getCurrentUserHandler,
} from '@/server/settings.server';
import * as auth from '@/server/auth';
import * as dbMod from '@/db/index';
import * as storage from '@/lib/storage';
import * as fs from 'node:fs';
import * as path from 'node:path';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/storage', () => ({
  generateFileKey: vi.fn(),
  generatePresignedUploadUrl: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

// Schema validation tests
describe('Settings schemas', () => {
  describe('UpdateProfileSchema', () => {
    it('should accept valid name', () => {
      const result = UpdateProfileSchema.safeParse({ name: 'John Doe' });
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const result = UpdateProfileSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });

    it('should reject name exceeding 100 characters', () => {
      const result = UpdateProfileSchema.safeParse({ name: 'a'.repeat(101) });
      expect(result.success).toBe(false);
    });

    it('should accept name at exactly 100 characters', () => {
      const result = UpdateProfileSchema.safeParse({ name: 'a'.repeat(100) });
      expect(result.success).toBe(true);
    });
  });

  describe('UpdateUserSettingsSchema', () => {
    it('should accept valid settings', () => {
      const result = UpdateUserSettingsSchema.safeParse({ reducedMotion: true });
      expect(result.success).toBe(true);
    });

    it('should accept reducedMotion false', () => {
      const result = UpdateUserSettingsSchema.safeParse({ reducedMotion: false });
      expect(result.success).toBe(true);
    });

    it('should reject non-boolean reducedMotion', () => {
      const result = UpdateUserSettingsSchema.safeParse({ reducedMotion: 'yes' });
      expect(result.success).toBe(false);
    });

    it('should reject missing reducedMotion', () => {
      const result = UpdateUserSettingsSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('GetPresignedAvatarUploadUrlSchema', () => {
    it('should accept valid extension', () => {
      const result = GetPresignedAvatarUploadUrlSchema.safeParse({ extension: 'jpg' });
      expect(result.success).toBe(true);
    });

    it('should reject empty extension', () => {
      const result = GetPresignedAvatarUploadUrlSchema.safeParse({ extension: '' });
      expect(result.success).toBe(false);
    });

    it('should reject missing extension', () => {
      const result = GetPresignedAvatarUploadUrlSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});

// Server function stub tests
describe('Settings server function stubs', () => {
  it('should export updateProfile as a function', () => {
    expect(typeof updateProfile).toBe('function');
  });

  it('should export updateUserSettings as a function', () => {
    expect(typeof updateUserSettings).toBe('function');
  });

  it('should export getPresignedAvatarUploadUrl as a function', () => {
    expect(typeof getPresignedAvatarUploadUrl).toBe('function');
  });

  it('should export getCurrentUser as a function', () => {
    expect(typeof getCurrentUser).toBe('function');
  });
});

// Input validation wiring tests (BUG-15)
describe('Settings input validation wiring (BUG-15)', () => {
  it('should wire UpdateProfileSchema to updateProfile stub via inputValidator', async () => {
    const { createServerFn } = await import('@tanstack/react-start');
    const mockObj = (createServerFn as any)();
    expect(mockObj.inputValidator).toHaveBeenCalledWith(UpdateProfileSchema);
  });

  it('should wire UpdateUserSettingsSchema to updateUserSettings stub via inputValidator', async () => {
    const { createServerFn } = await import('@tanstack/react-start');
    const mockObj = (createServerFn as any)();
    expect(mockObj.inputValidator).toHaveBeenCalledWith(UpdateUserSettingsSchema);
  });

  it('should wire GetPresignedAvatarUploadUrlSchema to getPresignedAvatarUploadUrl stub via inputValidator', async () => {
    const { createServerFn } = await import('@tanstack/react-start');
    const mockObj = (createServerFn as any)();
    expect(mockObj.inputValidator).toHaveBeenCalledWith(GetPresignedAvatarUploadUrlSchema);
  });

  it('AC-5: should not have args as { ... } casts in settings.server.ts', () => {
    const filePath = path.resolve(process.cwd(), 'src/server/settings.server.ts');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).not.toContain('args as {');
  });
});

// Handler tests
describe('Settings handlers', () => {
  let mockDb: any;
  const mockSession = {
    user: {
      id: 'user-1',
      role: 'student' as const,
      name: 'John',
      email: 'john@test.com',
      image: null,
    },
    session: {} as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      then: vi.fn(function (onfulfilled: any) {
        return Promise.resolve([]).then(onfulfilled);
      }),
    };
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  describe('updateProfileHandler', () => {
    it('should reject if unauthorized (no session)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await updateProfileHandler({ data: { name: 'John Updated' } });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should update users.name and return updated user', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as any);
      const updatedUser = { ...mockSession.user, name: 'John Updated' };
      mockDb.returning.mockReturnValue({
        then: (onfulfilled: any) => Promise.resolve([updatedUser]).then(onfulfilled),
      });

      const result = await updateProfileHandler({ data: { name: 'John Updated' } });
      expect(mockDb.set).toHaveBeenCalledWith({ name: 'John Updated' });
      expect(result).toEqual(updatedUser);
    });

    it('should return error on database failure', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as any);
      mockDb.returning.mockReturnValue({
        then: (_onfulfilled: any, onrejected: any) =>
          Promise.reject(new Error('DB error')).catch(onrejected),
      });

      const result = await updateProfileHandler({ data: { name: 'John Updated' } });
      expect(result).toEqual({ error: { code: 'INTERNAL', message: 'Internal Server Error' } });
    });
  });

  describe('getPresignedAvatarUploadUrlHandler', () => {
    it('should reject if unauthorized (no session)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await getPresignedAvatarUploadUrlHandler({ data: { extension: 'jpg' } });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should generate correct avatars/ key prefix and return presigned URL', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as any);
      vi.mocked(storage.generateFileKey).mockReturnValue('avatars/uuid.jpg');
      vi.mocked(storage.generatePresignedUploadUrl).mockResolvedValue(
        'https://fake-upload.example.com/avatars/uuid.jpg',
      );

      const result = await getPresignedAvatarUploadUrlHandler({ data: { extension: 'jpg' } });
      expect(storage.generateFileKey).toHaveBeenCalledWith('jpg', 'avatars');
      expect(storage.generatePresignedUploadUrl).toHaveBeenCalledWith({
        key: 'avatars/uuid.jpg',
        contentType: 'image/jpeg',
      });
      expect(result).toEqual({
        uploadUrl: 'https://fake-upload.example.com/avatars/uuid.jpg',
        fileKey: 'avatars/uuid.jpg',
      });
    });

    it('should return error for unsupported image type', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as any);
      const result = await getPresignedAvatarUploadUrlHandler({ data: { extension: 'exe' } });
      expect(result).toEqual({ error: { code: 'BAD_REQUEST', message: 'Unsupported image type' } });
    });

    it('should handle storage failure gracefully', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as any);
      vi.mocked(storage.generatePresignedUploadUrl).mockRejectedValue(
        new Error('R2 not configured'),
      );

      const result = await getPresignedAvatarUploadUrlHandler({ data: { extension: 'jpg' } });
      expect(result).toEqual({ error: { code: 'INTERNAL', message: 'Internal Server Error' } });
    });
  });

  describe('updateUserSettingsHandler', () => {
    it('should reject if unauthorized (no session)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await updateUserSettingsHandler({ data: { reducedMotion: true } });
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should update settings jsonb and return updated settings', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as any);
      const updatedSettings = { reducedMotion: true };
      mockDb.returning.mockReturnValue({
        then: (onfulfilled: any) =>
          Promise.resolve([{ settings: updatedSettings }]).then(onfulfilled),
      });

      const result = await updateUserSettingsHandler({ data: { reducedMotion: true } });
      expect(mockDb.set).toHaveBeenCalledWith({ settings: { reducedMotion: true } });
      expect(result).toEqual(updatedSettings);
    });

    it('should handle database failure gracefully', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as any);
      mockDb.returning.mockReturnValue({
        then: (_onfulfilled: any, onrejected: any) =>
          Promise.reject(new Error('DB error')).catch(onrejected),
      });

      const result = await updateUserSettingsHandler({ data: { reducedMotion: false } });
      expect(result).toEqual({ error: { code: 'INTERNAL', message: 'Internal Server Error' } });
    });
  });

  describe('getCurrentUserHandler', () => {
    it('should reject if unauthorized (no session)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await getCurrentUserHandler();
      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should return user data and settings for authenticated user', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as any);
      const mockRecord = {
        name: 'John',
        email: 'john@test.com',
        image: null,
        settings: { reducedMotion: true },
      };
      mockDb.limit = vi.fn().mockReturnThis();
      mockDb.then = vi.fn((onfulfilled: any) => Promise.resolve([mockRecord]).then(onfulfilled));

      const result = await getCurrentUserHandler();
      expect(result).toEqual({
        user: { id: 'user-1', name: 'John', email: 'john@test.com', image: null },
        settings: { reducedMotion: true },
      });
    });

    it('should return null settings when user has no settings', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as any);
      const mockRecord = {
        name: 'John',
        email: 'john@test.com',
        image: null,
        settings: null,
      };
      mockDb.limit = vi.fn().mockReturnThis();
      mockDb.then = vi.fn((onfulfilled: any) => Promise.resolve([mockRecord]).then(onfulfilled));

      const result = await getCurrentUserHandler();
      expect(result).toEqual({
        user: { id: 'user-1', name: 'John', email: 'john@test.com', image: null },
        settings: null,
      });
    });

    it('should return error when user not found', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as any);
      mockDb.limit = vi.fn().mockReturnThis();
      mockDb.then = vi.fn((onfulfilled: any) => Promise.resolve([undefined]).then(onfulfilled));

      const result = await getCurrentUserHandler();
      expect(result).toEqual({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    });

    it('should handle database failure gracefully', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as any);
      mockDb.limit = vi.fn().mockReturnThis();
      mockDb.then = vi.fn((_onfulfilled: any, onrejected: any) =>
        Promise.reject(new Error('DB error')).catch(onrejected),
      );

      const result = await getCurrentUserHandler();
      expect(result).toEqual({ error: { code: 'INTERNAL', message: 'Internal Server Error' } });
    });
  });
});
