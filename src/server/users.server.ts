// Server-only helpers (not imported by client code)
import { eq, and, isNull, sql, ne } from 'drizzle-orm';
import crypto from 'node:crypto';
import { getDb } from '../db/index';
import { users, verification } from '../db/schema/index';
import { sendInvitationEmail } from '../lib/email';
import { logAuditEvent } from '../lib/audit';
import { revokeUserSessions } from '../lib/auth-session';
import { getSessionFromHeaders } from './auth';
import type { z } from 'zod';
import type {
  CreateUserSchema,
  UpdateUserSchema,
  ListUsersSchema,
  UserIdParamSchema,
} from './users';

type CreateUserInput = z.infer<typeof CreateUserSchema>;
type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
type ListUsersInput = z.infer<typeof ListUsersSchema>;
type UserIdParam = z.infer<typeof UserIdParamSchema>;

export async function listUsersHandler(args: { data: ListUsersInput }) {
  const session = await getSessionFromHeaders();
  if (!session) {
    return { users: [], total: 0 };
  }

  const isAdmin = session.user.role === 'admin' || session.user.role === 'superadmin';
  const isInstructor = session.user.role === 'instructor';

  if (!isAdmin && !isInstructor) {
    return { users: [], total: 0 };
  }

  const { search, page, limit } = args.data;
  let { role } = args.data;

  // Instructors are only authorized to search/list student users
  if (isInstructor) {
    role = 'student';
  }

  const db = getDb();
  const conditions = [isNull(users.deletedAt)];

  // For non-superadmin admins, also filter out superadmin users
  if (session.user.role === 'admin') {
    conditions.push(ne(users.role, 'superadmin'));
  }

  if (search) {
    conditions.push(
      sql`${users.name} ILIKE ${'%' + search + '%'} OR ${users.email} ILIKE ${'%' + search + '%'}`,
    );
  }

  if (role) {
    conditions.push(eq(users.role, role));
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
    .orderBy(users.createdAt)
    .limit(limit)
    .offset((page - 1) * limit);

  // Get total count for pagination
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(and(...conditions));

  return {
    users: allUsers,
    total: Number(count),
  };
}

export async function getUserHandler(args: { data: UserIdParam }) {
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
    .where(and(eq(users.id, args.data.id), isNull(users.deletedAt)))
    .limit(1);

  const user = userRecord[0] ?? null;

  // Non-SuperAdmin requesting a SuperAdmin user returns null (404)
  if (user && session.user.role !== 'superadmin' && user.role === 'superadmin') {
    return null;
  }

  return user;
}

// Role-based creation allowlist — imported from shared module (canonical source of truth)
import { CREATION_ALLOWED_ROLES } from '../lib/role-permissions';

export async function createUserHandler(args: { data: CreateUserInput }) {
  const session = await getSessionFromHeaders();
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const { name, email: userEmail, role } = args.data;

  // Enforce role creation boundaries. SuperAdmin creates Admins only;
  // Admin creates Instructors/Students only. Other actor roles are rejected.
  const allowedRoles = CREATION_ALLOWED_ROLES[session.user.role];
  if (!allowedRoles || !allowedRoles.includes(role)) {
    if (session.user.role === 'admin' && role === 'admin') {
      return { error: 'Admins cannot create other Admin accounts' };
    }
    return { error: 'Unauthorized' };
  }

  const db = getDb();

  // Check if email already in use (active or soft-deleted)
  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, userEmail))
    .limit(1)
    .then((rows) => rows[0]);

  if (existingUser) {
    return { error: 'Email already in use' };
  }

  const userId = crypto.randomUUID();
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.insert(users).values({
    id: userId,
    name,
    email: userEmail,
    role: role as 'admin' | 'instructor' | 'student',
    locale: session.user.locale || 'en',
  });

  await logAuditEvent({
    actorId: session.user.id,
    action: 'user.created',
    entityType: 'user',
    entityId: userId,
    details: { role, email: userEmail },
  });

  await db.insert(verification).values({
    id: crypto.randomUUID(),
    identifier: userEmail,
    value: token,
    expiresAt,
  });

  let emailSent = false;
  try {
    await sendInvitationEmail({
      email: userEmail,
      name,
      token,
    });
    emailSent = true;
  } catch (err) {
    // Email failure is non-fatal as per spec
    console.error('Failed to send invitation email:', err);
  }

  return { user: { id: userId }, emailSent };
}

export async function updateUserHandler(args: { data: UpdateUserInput & { id: string } }) {
  const session = await getSessionFromHeaders();
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
    return { error: 'Unauthorized' };
  }

  const { id, name, email: userEmail } = args.data;
  const db = getDb();

  // Validate email uniqueness against other active users
  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, userEmail), ne(users.id, id), isNull(users.deletedAt)))
    .limit(1)
    .then((rows) => rows[0]);

  if (existingUser) {
    return { error: 'Email already in use' };
  }

  await db
    .update(users)
    .set({ name, email: userEmail, updatedAt: new Date() })
    .where(eq(users.id, id));

  return { success: true };
}

export async function deleteUserHandler(args: { data: UserIdParam }) {
  const session = await getSessionFromHeaders();
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
    return { error: 'Unauthorized' };
  }

  if (session.user.id === args.data.id) {
    return { error: 'You cannot delete your own account' };
  }

  const db = getDb();

  // Revoke all sessions for the user before soft-deleting, so they are
  // immediately logged out on every device.
  await revokeUserSessions(args.data.id, session.user.id);

  await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, args.data.id));

  await logAuditEvent({
    actorId: session.user.id,
    action: 'user.deleted',
    entityType: 'user',
    entityId: args.data.id,
  });

  return { success: true };
}

export async function generateSetupLinkHandler(args: { data: UserIdParam }) {
  const session = await getSessionFromHeaders();
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
    return { error: 'Unauthorized' };
  }

  const db = getDb();
  const user = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.id, args.data.id), isNull(users.deletedAt)))
    .then((rows) => rows[0]);

  if (!user) {
    return { error: 'User not found or deleted' };
  }

  const token = crypto.randomUUID();

  // Invalidate any existing setup/verification tokens for this email
  // before issuing a new one.
  await db.delete(verification).where(eq(verification.identifier, user.email));

  await db.insert(verification).values({
    id: crypto.randomUUID(),
    identifier: user.email,
    value: token,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
  });

  const setupUrl = `${process.env.BETTER_AUTH_URL || 'http://localhost:3000'}/auth/setup-password?token=${token}`;
  return { url: setupUrl };
}
