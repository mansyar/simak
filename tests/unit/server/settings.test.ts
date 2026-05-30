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
      const result = await updateProfileHandler({ name: 'John Updated' });
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should update users.name and return updated user', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as any);
      const updatedUser = { ...mockSession.user, name: 'John Updated' };
      mockDb.returning.mockReturnValue({
        then: (onfulfilled: any) => Promise.resolve([updatedUser]).then(onfulfilled),
      });

      const result = await updateProfileHandler({ name: 'John Updated' });
      expect(mockDb.set).toHaveBeenCalledWith({ name: 'John Updated' });
      expect(result).toEqual(updatedUser);
    });

    it('should return error on database failure', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as any);
      mockDb.returning.mockReturnValue({
        then: (_onfulfilled: any, onrejected: any) =>
          Promise.reject(new Error('DB error')).catch(onrejected),
      });

      const result = await updateProfileHandler({ name: 'John Updated' });
      expect(result).toEqual({ error: 'Failed to update profile' });
    });
  });

  describe('getPresignedAvatarUploadUrlHandler', () => {
    it('should reject if unauthorized (no session)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await getPresignedAvatarUploadUrlHandler({ extension: 'jpg' });
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should generate correct avatars/ key prefix and return presigned URL', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as any);
      vi.mocked(storage.generateFileKey).mockReturnValue('avatars/uuid.jpg');
      vi.mocked(storage.generatePresignedUploadUrl).mockResolvedValue(
        'https://fake-upload.example.com/avatars/uuid.jpg',
      );

      const result = await getPresignedAvatarUploadUrlHandler({ extension: 'jpg' });
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
      const result = await getPresignedAvatarUploadUrlHandler({ extension: 'exe' });
      expect(result).toEqual({ error: 'Unsupported image type' });
    });

    it('should handle storage failure gracefully', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as any);
      vi.mocked(storage.generatePresignedUploadUrl).mockRejectedValue(
        new Error('R2 not configured'),
      );

      const result = await getPresignedAvatarUploadUrlHandler({ extension: 'jpg' });
      expect(result).toEqual({ error: 'Failed to generate upload URL' });
    });
  });

  describe('updateUserSettingsHandler', () => {
    it('should reject if unauthorized (no session)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await updateUserSettingsHandler({ reducedMotion: true });
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should update settings jsonb and return updated settings', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as any);
      const updatedSettings = { reducedMotion: true };
      mockDb.returning.mockReturnValue({
        then: (onfulfilled: any) =>
          Promise.resolve([{ settings: updatedSettings }]).then(onfulfilled),
      });

      const result = await updateUserSettingsHandler({ reducedMotion: true });
      expect(mockDb.set).toHaveBeenCalledWith({ settings: { reducedMotion: true } });
      expect(result).toEqual(updatedSettings);
    });

    it('should handle database failure gracefully', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as any);
      mockDb.returning.mockReturnValue({
        then: (_onfulfilled: any, onrejected: any) =>
          Promise.reject(new Error('DB error')).catch(onrejected),
      });

      const result = await updateUserSettingsHandler({ reducedMotion: false });
      expect(result).toEqual({ error: 'Failed to update settings' });
    });
  });

  describe('getCurrentUserHandler', () => {
    it('should reject if unauthorized (no session)', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(null);
      const result = await getCurrentUserHandler();
      expect(result).toEqual({ error: 'Unauthorized' });
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
      expect(result).toEqual({ error: 'User not found' });
    });

    it('should handle database failure gracefully', async () => {
      vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(mockSession as any);
      mockDb.limit = vi.fn().mockReturnThis();
      mockDb.then = vi.fn((_onfulfilled: any, onrejected: any) =>
        Promise.reject(new Error('DB error')).catch(onrejected),
      );

      const result = await getCurrentUserHandler();
      expect(result).toEqual({ error: 'Failed to fetch user data' });
    });
  });
});
