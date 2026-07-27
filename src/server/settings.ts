// Client-safe server function wrappers (Zod schemas + typedServerFn stubs)
// Handler implementations are in settings.server.ts (not bundled for client)
import { typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';

export const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(100),
});

export const UpdateUserSettingsSchema = z.object({
  reducedMotion: z.boolean().optional(),
  notificationPrefs: z
    .record(z.string(), z.object({ email: z.boolean().optional(), inApp: z.boolean().optional() }))
    .optional(),
});

export const GetPresignedAvatarUploadUrlSchema = z.object({
  extension: z.string().min(1),
});

export const GetCurrentUserSchema = z.object({});

export const updateProfile = typedServerFn({ method: 'POST' })
  .inputValidator(UpdateProfileSchema)
  .handler(async ({ data }) => {
    const { updateProfileHandler } = await import('./settings.server');
    return updateProfileHandler({ data });
  });

export const updateUserSettings = typedServerFn({ method: 'POST' })
  .inputValidator(UpdateUserSettingsSchema)
  .handler(async ({ data }) => {
    const { updateUserSettingsHandler } = await import('./settings.server');
    return updateUserSettingsHandler({ data });
  });

export const getPresignedAvatarUploadUrl = typedServerFn({ method: 'POST' })
  .inputValidator(GetPresignedAvatarUploadUrlSchema)
  .handler(async ({ data }) => {
    const { getPresignedAvatarUploadUrlHandler } = await import('./settings.server');
    return getPresignedAvatarUploadUrlHandler({ data });
  });

export const getCurrentUser = typedServerFn({ method: 'GET' }).handler(async () => {
  const { getCurrentUserHandler } = await import('./settings.server');
  return getCurrentUserHandler();
});
