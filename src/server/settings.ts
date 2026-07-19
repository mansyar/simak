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

export const updateProfile = createServerFn({ method: 'POST' })
  .inputValidator(UpdateProfileSchema)
  .handler(async ({ data }) => {
    const { updateProfileHandler } = await import('./settings.server');
    return updateProfileHandler({ data });
  });

export const updateUserSettings = createServerFn({ method: 'POST' })
  .inputValidator(UpdateUserSettingsSchema)
  .handler(async ({ data }) => {
    const { updateUserSettingsHandler } = await import('./settings.server');
    return updateUserSettingsHandler({ data });
  });

export const getPresignedAvatarUploadUrl = createServerFn({ method: 'POST' })
  .inputValidator(GetPresignedAvatarUploadUrlSchema)
  .handler(async ({ data }) => {
    const { getPresignedAvatarUploadUrlHandler } = await import('./settings.server');
    return getPresignedAvatarUploadUrlHandler({ data });
  });

export const getCurrentUser = createServerFn({ method: 'GET' }).handler(async () => {
  const { getCurrentUserHandler } = await import('./settings.server');
  return getCurrentUserHandler();
});
