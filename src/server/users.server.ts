// Server-only helpers (not imported by client code)
import { eq, and, isNull, sql, ne } from 'drizzle-orm';
import crypto from 'node:crypto';
import { getDb } from '../db/index';
import {
  users,
  verification,
  assignments,
  consultations,
  extensionRequests,
  uploadIntents,
} from '../db/schema/index';
import { sendInvitationEmail } from '../lib/email';
import { logAuditEvent } from '../lib/audit';
import { revokeUserSessions } from '../lib/auth-session';
import { getSessionFromHeaders } from './auth';
import { serverError, ErrorCode } from '../lib/errors';
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

  const db = getDb();

  try {
    const { search, page, limit } = args.data;
    let { role } = args.data;

    // Instructors are only authorized to search/list student users
    if (isInstructor) {
      role = 'student';
    }

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
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'listUsersHandler',
    });
  }
}

export async function getUserHandler(args: { data: UserIdParam }) {
  const session = await getSessionFromHeaders();
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
    return null;
  }

  const db = getDb();

  try {
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
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'getUserHandler',
    });
  }
}

// Role-based creation allowlist — imported from shared module (canonical source of truth)
import { CREATION_ALLOWED_ROLES } from '../lib/role-permissions';

export async function createUserHandler(args: { data: CreateUserInput }) {
  const session = await getSessionFromHeaders();
  if (!session) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { name, email: userEmail, role } = args.data;

  // Enforce role creation boundaries. SuperAdmin creates Admins only;
  // Admin creates Instructors/Students only. Other actor roles are rejected.
  const allowedRoles = CREATION_ALLOWED_ROLES[session.user.role];
  if (!allowedRoles || !allowedRoles.includes(role)) {
    if (session.user.role === 'admin' && role === 'admin') {
      return serverError(ErrorCode.BAD_REQUEST, 'Admins cannot create other Admin accounts');
    }
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const db = getDb();

  try {
    let userId = '';
    let auditAction: 'user.created' | 'user.reactivated' = 'user.created';
    let status: 'created' | 'restored' = 'created';
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const result = await db.transaction(async (tx) => {
      // Email uniqueness check with FOR UPDATE (BUG-22: prevent TOCTOU race)
      const [existingUser] = await tx
        .select({ id: users.id, deletedAt: users.deletedAt })
        .from(users)
        .where(eq(users.email, userEmail))
        .limit(1)
        .for('update', { of: users });

      if (existingUser) {
        if (existingUser.deletedAt == null) {
          return serverError(ErrorCode.BAD_REQUEST, 'Email already in use');
        }
        userId = existingUser.id;
        auditAction = 'user.reactivated';
        status = 'restored';
      } else {
        userId = crypto.randomUUID();
      }

      if (status === 'restored') {
        await tx
          .update(users)
          .set({
            deletedAt: null,
            name,
            role: role as 'admin' | 'instructor' | 'student',
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));

        // Clear any stale verification token so a fresh invitation can be sent
        await tx.delete(verification).where(eq(verification.identifier, userEmail));
      } else {
        await tx.insert(users).values({
          id: userId,
          name,
          email: userEmail,
          role: role as 'admin' | 'instructor' | 'student',
          locale: session.user.locale || 'en',
        });
      }

      await tx.insert(verification).values({
        id: crypto.randomUUID(),
        identifier: userEmail,
        value: token,
        expiresAt,
      });

      return { success: true as const };
    });

    if ('error' in result) {
      return result;
    }

    // Post-commit advisory work: audit log is non-fatal (styleguide §6.4)
    try {
      await logAuditEvent({
        actorId: session.user.id,
        action: auditAction,
        entityType: 'user',
        entityId: userId,
        details: { role, email: userEmail, status },
      });
    } catch (err) {
      console.error(`Failed to log ${auditAction} audit event:`, err);
    }

    // Post-commit advisory work: invitation email is non-fatal
    let emailSent = false;
    try {
      await sendInvitationEmail({
        email: userEmail,
        name,
        token,
      });
      emailSent = true;
    } catch (err) {
      console.error('Failed to send invitation email:', err);
    }

    return { user: { id: userId }, emailSent };
  } catch (err) {
    // BUG-22: Catch unique constraint violation as safety net for concurrent inserts
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      return serverError(ErrorCode.BAD_REQUEST, 'Email already in use');
    }
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'createUserHandler',
    });
  }
}

export async function updateUserHandler(args: { data: UpdateUserInput & { id: string } }) {
  const session = await getSessionFromHeaders();
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { id, name, email: userEmail } = args.data;
  const db = getDb();

  try {
    const result = await db.transaction(async (tx) => {
      // Email uniqueness check with FOR UPDATE (BUG-22: prevent TOCTOU race)
      const [existingUser] = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, userEmail), ne(users.id, id), isNull(users.deletedAt)))
        .limit(1)
        .for('update', { of: users });

      if (existingUser) {
        return serverError(ErrorCode.BAD_REQUEST, 'Email already in use');
      }

      await tx
        .update(users)
        .set({ name, email: userEmail, updatedAt: new Date() })
        .where(eq(users.id, id));

      return { success: true as const };
    });

    return result;
  } catch (err) {
    // BUG-22: Catch unique constraint violation as safety net
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      return serverError(ErrorCode.BAD_REQUEST, 'Email already in use');
    }
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'updateUserHandler',
    });
  }
}

export async function deleteUserHandler(args: { data: UserIdParam }) {
  const session = await getSessionFromHeaders();
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  if (session.user.id === args.data.id) {
    return serverError(ErrorCode.BAD_REQUEST, 'You cannot delete your own account');
  }

  const db = getDb();

  try {
    // Fetch user to determine role for cleanup
    const [user] = await db.select().from(users).where(eq(users.id, args.data.id)).limit(1);
    if (!user || user.deletedAt) {
      return serverError(ErrorCode.NOT_FOUND, 'User not found or already deleted');
    }

    const deleteResult = await db.transaction(async (tx) => {
      // Block instructor soft-delete if they have active assignments (under lock)
      if (user.role === 'instructor') {
        const [activeAssignment] = await tx
          .select({ id: assignments.id })
          .from(assignments)
          .where(and(eq(assignments.instructorId, args.data.id), isNull(assignments.deletedAt)))
          .for('update', { of: assignments })
          .limit(1);
        if (activeAssignment) {
          return serverError(
            ErrorCode.BAD_REQUEST,
            'Instructor has active assignments. Reassign them first.',
          );
        }
      }

      if (user.role === 'student') {
        // Auto-reject pending consultations
        await tx
          .update(consultations)
          .set({ status: 'rejected', notes: 'User deleted' })
          .where(
            and(eq(consultations.studentId, args.data.id), eq(consultations.status, 'pending')),
          );

        // Auto-reject pending extension requests
        await tx
          .update(extensionRequests)
          .set({ status: 'rejected', resolutionReason: 'User deleted' })
          .where(
            and(
              eq(extensionRequests.studentId, args.data.id),
              eq(extensionRequests.status, 'pending'),
            ),
          );

        // Revoke open upload intents
        await tx
          .update(uploadIntents)
          .set({ consumedAt: new Date() })
          .where(and(eq(uploadIntents.userId, args.data.id), isNull(uploadIntents.consumedAt)));
      }

      // Soft-delete the user
      await tx.update(users).set({ deletedAt: new Date() }).where(eq(users.id, args.data.id));
    });

    if (deleteResult) {
      return deleteResult;
    }

    // Revoke all sessions (post-commit advisory work)
    try {
      await revokeUserSessions(args.data.id, session.user.id);
    } catch (err) {
      console.error('Failed to revoke sessions post-commit (user already soft-deleted):', err);
    }

    await logAuditEvent({
      actorId: session.user.id,
      action: 'user.deleted',
      entityType: 'user',
      entityId: args.data.id,
    });

    return { success: true };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'deleteUserHandler',
    });
  }
}

export async function generateSetupLinkHandler(args: { data: UserIdParam }) {
  const session = await getSessionFromHeaders();
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const db = getDb();

  try {
    const user = await db
      .select({ email: users.email })
      .from(users)
      .where(and(eq(users.id, args.data.id), isNull(users.deletedAt)))
      .then((rows) => rows[0]);

    if (!user) {
      return serverError(ErrorCode.NOT_FOUND, 'User not found or deleted');
    }

    const token = crypto.randomUUID();

    // Invalidate any existing setup/verification tokens and insert the new one
    // in a single transaction (BUG-13: DELETE + INSERT must be atomic)
    await db.transaction(async (tx) => {
      await tx.delete(verification).where(eq(verification.identifier, user.email));

      await tx.insert(verification).values({
        id: crypto.randomUUID(),
        identifier: user.email,
        value: token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      });
    });

    const setupUrl = `${process.env.BETTER_AUTH_URL || 'http://localhost:3000'}/auth/setup-password?token=${token}`;
    return { url: setupUrl };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'generateSetupLinkHandler',
    });
  }
}

export async function listInstructorActiveAssignmentsHandler(args: {
  data: { instructorId: string };
}) {
  const session = await getSessionFromHeaders();
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const db = getDb();
  const result = await db
    .select({ id: assignments.id, title: assignments.title })
    .from(assignments)
    .where(
      and(eq(assignments.instructorId, args.data.instructorId), isNull(assignments.deletedAt)),
    );

  return { assignments: result };
}
