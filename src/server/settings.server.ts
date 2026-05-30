// Server-only handlers for settings
import { getSessionFromHeaders } from './auth';
import { getDb } from '@/db/index';
import { users } from '@/db/schema/users';
import { eq } from 'drizzle-orm';
import { generateFileKey, generatePresignedUploadUrl } from '@/lib/storage';

const SUPPORTED_IMAGE_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

export async function updateProfileHandler(args: unknown) {
  const session = await getSessionFromHeaders();
  if (!session) return { error: 'Unauthorized' };

  const { user } = session;
  const { name } = args as { name: string };

  try {
    const db = getDb();
    const [updatedUser] = await db
      .update(users)
      .set({ name })
      .where(eq(users.id, user.id))
      .returning();

    return updatedUser;
  } catch {
    return { error: 'Failed to update profile' };
  }
}

export async function getPresignedAvatarUploadUrlHandler(args: unknown) {
  const session = await getSessionFromHeaders();
  if (!session) return { error: 'Unauthorized' };

  const { extension } = args as { extension: string };
  const contentType = SUPPORTED_IMAGE_TYPES[extension.toLowerCase()];
  if (!contentType) return { error: 'Unsupported image type' };

  try {
    const fileKey = generateFileKey(extension, 'avatars');
    const uploadUrl = await generatePresignedUploadUrl({ key: fileKey, contentType });
    return { uploadUrl, fileKey };
  } catch {
    return { error: 'Failed to generate upload URL' };
  }
}

export async function updateUserSettingsHandler(args: unknown) {
  const session = await getSessionFromHeaders();
  if (!session) return { error: 'Unauthorized' };

  const { user } = session;
  const { reducedMotion } = args as { reducedMotion: boolean };

  try {
    const db = getDb();
    const [updated] = await db
      .update(users)
      .set({ settings: { reducedMotion } })
      .where(eq(users.id, user.id))
      .returning({ settings: users.settings });

    return updated.settings;
  } catch {
    return { error: 'Failed to update settings' };
  }
}
