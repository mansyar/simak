// Client-safe server function wrappers (Zod schemas + createServerFn stubs)
// Handler implementations are in settings.server.ts (not bundled for client)
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

export const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(100),
});

export const UpdateUserSettingsSchema = z.object({
  reducedMotion: z.boolean(),
});

export const GetPresignedAvatarUploadUrlSchema = z.object({
  extension: z.string().min(1),
});

export const GetCurrentUserSchema = z.object({});

export const updateProfile = createServerFn({ method: 'POST' }).handler(async (args: unknown) => {
  const { updateProfileHandler } = await import('./settings.server');
  return updateProfileHandler(args);
});

export const updateUserSettings = createServerFn({ method: 'POST' }).handler(
  async (args: unknown) => {
    const { updateUserSettingsHandler } = await import('./settings.server');
    return updateUserSettingsHandler(args);
  },
);

export const getPresignedAvatarUploadUrl = createServerFn({ method: 'POST' }).handler(
  async (args: unknown) => {
    const { getPresignedAvatarUploadUrlHandler } = await import('./settings.server');
    return getPresignedAvatarUploadUrlHandler(args);
  },
);

export const getCurrentUser = createServerFn({ method: 'GET' }).handler(async (_args: unknown) => {
  const { getCurrentUserHandler } = await import('./settings.server');
  return getCurrentUserHandler();
});
