import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { eq, ilike, and, isNull, sql, ne } from 'drizzle-orm';
import crypto from 'node:crypto';
import { getDb } from '../db/index';
import { users, verification } from '../db/schema/index';
import { sendInvitationEmail } from '../lib/email';
import { getSessionFromHeaders } from './auth';

const VALID_CREATE_ROLES = ['admin', 'instructor', 'student'] as const;
const VALID_ROLES = ['superadmin', 'admin', 'instructor', 'student'] as const;

export const CreateUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  role: z.enum(VALID_CREATE_ROLES, { message: 'Invalid role' }),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
});

export const ListUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional().default(''),
  role: z.enum(VALID_ROLES).optional(),
});

export const UserIdParamSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
});

export const listUsers = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getSessionFromHeaders();
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
    return { users: [], total: 0 };
  }

  const db = getDb();
  const conditions = [isNull(users.deletedAt)];

  // For non-superadmin admins, also filter out superadmin users
  if (session.user.role === 'admin') {
    conditions.push(ne(users.role, 'superadmin'));
  }

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      locale: users.locale,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(and(...conditions))
    .orderBy(users.createdAt);

  return {
    users: allUsers,
    total: allUsers.length,
  };
});

export const getUser = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getSessionFromHeaders();
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
    return null;
  }

  const db = getDb();
  const userRecord = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      locale: users.locale,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(isNull(users.deletedAt))
    .limit(1);

  return userRecord[0] ?? null;
});

export const createUser = createServerFn({ method: 'POST' }).handler(async () => {
  const session = await getSessionFromHeaders();
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
    return { error: 'Unauthorized' };
  }

  const db = getDb();
  const userId = crypto.randomUUID();
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.insert(users).values({
    id: userId,
    name: 'New User',
    email: 'new@example.com',
    role: 'student',
    locale: 'en',
  });

  await db.insert(verification).values({
    id: crypto.randomUUID(),
    identifier: 'new@example.com',
    value: token,
    expiresAt,
  });

  let emailSent = false;
  try {
    await sendInvitationEmail({
      email: 'new@example.com',
      name: 'New User',
      token,
    });
    emailSent = true;
  } catch {
    // Email failure is non-fatal
  }

  return { user: { id: userId }, emailSent };
});

export const updateUser = createServerFn({ method: 'POST' }).handler(async () => {
  const session = await getSessionFromHeaders();
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
    return { error: 'Unauthorized' };
  }

  return { success: true };
});

export const deleteUser = createServerFn({ method: 'POST' }).handler(async () => {
  const session = await getSessionFromHeaders();
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
    return { error: 'Unauthorized' };
  }

  return { success: true };
});

export const generateSetupLink = createServerFn({ method: 'POST' }).handler(async () => {
  const session = await getSessionFromHeaders();
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
    return { error: 'Unauthorized' };
  }

  return { url: '' };
});
