// Server-only handlers for settings
import { getSessionFromHeaders } from './auth';
import { getDb } from '@/db/index';
import { users } from '@/db/schema/users';
import { eq } from 'drizzle-orm';
import { generateFileKey, generatePresignedUploadUrl } from '@/lib/storage';
import { serverError, ErrorCode } from '@/lib/errors';
import type { z } from 'zod';
import type {
  UpdateProfileSchema,
  UpdateUserSettingsSchema,
  GetPresignedAvatarUploadUrlSchema,
} from './settings';

type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
type UpdateUserSettingsInput = z.infer<typeof UpdateUserSettingsSchema>;
type GetPresignedAvatarUploadUrlInput = z.infer<typeof GetPresignedAvatarUploadUrlSchema>;

const SUPPORTED_IMAGE_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

export async function updateProfileHandler(args: { data: UpdateProfileInput }) {
  const session = await getSessionFromHeaders();
  if (!session) return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');

  const { user } = session;
  const { name } = args.data;

  try {
    const db = getDb();
    const [updatedUser] = await db
      .update(users)
      .set({ name })
      .where(eq(users.id, user.id))
      .returning();

    return updatedUser;
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'updateProfileHandler',
    });
  }
}

export async function getPresignedAvatarUploadUrlHandler(args: {
  data: GetPresignedAvatarUploadUrlInput;
}) {
  const session = await getSessionFromHeaders();
  if (!session) return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');

  const { extension } = args.data;
  const contentType = SUPPORTED_IMAGE_TYPES[extension.toLowerCase()];
  if (!contentType) return serverError(ErrorCode.BAD_REQUEST, 'Unsupported image type');

  try {
    const fileKey = generateFileKey(extension, 'avatars');
    const uploadUrl = await generatePresignedUploadUrl({ key: fileKey, contentType });
    return { uploadUrl, fileKey };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'getPresignedAvatarUploadUrlHandler',
    });
  }
}

export async function getCurrentUserHandler() {
  const session = await getSessionFromHeaders();
  if (!session) return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');

  const { user } = session;
  try {
    const db = getDb();
    const record = await db
      .select({
        name: users.name,
        email: users.email,
        image: users.image,
        settings: users.settings,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)
      .then((rows) => rows[0]);

    if (!record) return serverError(ErrorCode.NOT_FOUND, 'User not found');

    return {
      user: { id: user.id, name: record.name, email: record.email, image: record.image },
      settings: record.settings ?? null,
    };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'getCurrentUserHandler',
    });
  }
}

export async function updateUserSettingsHandler(args: { data: UpdateUserSettingsInput }) {
  const session = await getSessionFromHeaders();
  if (!session) return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');

  const { user } = session;
  const { reducedMotion } = args.data;

  try {
    const db = getDb();
    const [updated] = await db
      .update(users)
      .set({ settings: { reducedMotion } })
      .where(eq(users.id, user.id))
      .returning({ settings: users.settings });

    return updated.settings;
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'updateUserSettingsHandler',
    });
  }
}
