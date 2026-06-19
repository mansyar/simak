// Server-only handlers for settings
import { getSessionFromHeaders } from './auth';
import { getDb } from '@/db/index';
import { users } from '@/db/schema/users';
import { eq } from 'drizzle-orm';
import { generateFileKey, generatePresignedUploadUrl } from '@/lib/storage';
const SUPPORTED_IMAGE_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};
export async function updateProfileHandler(args) {
  const session = await getSessionFromHeaders();
  if (!session) return { error: 'Unauthorized' };
  const { user } = session;
  const { name } = args;
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
export async function getPresignedAvatarUploadUrlHandler(args) {
  const session = await getSessionFromHeaders();
  if (!session) return { error: 'Unauthorized' };
  const { extension } = args;
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
export async function getCurrentUserHandler() {
  const session = await getSessionFromHeaders();
  if (!session) return { error: 'Unauthorized' };
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
    if (!record) return { error: 'User not found' };
    return {
      user: { id: user.id, name: record.name, email: record.email, image: record.image },
      settings: record.settings ?? null,
    };
  } catch {
    return { error: 'Failed to fetch user data' };
  }
}
export async function updateUserSettingsHandler(args) {
  const session = await getSessionFromHeaders();
  if (!session) return { error: 'Unauthorized' };
  const { user } = session;
  const { reducedMotion } = args;
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
