// Client-safe server function wrappers (Zod schemas + typedServerFn stubs)
// Handler implementations are in settings.server.ts (not bundled for client)
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { serverFnMiddlewares, typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';
import {
  getCurrentUserHandler,
  getPresignedAvatarUploadUrlHandler,
  updateProfileHandler,
  updateUserSettingsHandler,
} from './settings.server';

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
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(UpdateProfileSchema)
  .handler(async ({ data }) => {
    return updateProfileHandler({ data });
  });

export const updateUserSettings = typedServerFn({
  method: 'POST',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(UpdateUserSettingsSchema)
  .handler(async ({ data }) => {
    return updateUserSettingsHandler({ data });
  });

export const getPresignedAvatarUploadUrl = typedServerFn({
  method: 'POST',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.presignedUrl))
  .inputValidator(GetPresignedAvatarUploadUrlSchema)
  .handler(async ({ data }) => {
    return getPresignedAvatarUploadUrlHandler({ data });
  });

export const getCurrentUser = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .handler(async () => {
    return getCurrentUserHandler();
  });
