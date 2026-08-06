import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { courseSections, sectionEnrollments } from '@/db/schema/academic-context';
import { users } from '@/db/schema/users';
import { getSessionFromHeaders } from './auth';
import { isAdmin } from '@/lib/session-guards';
import { safeAuditLog } from '@/lib/audit';
import { ErrorCode, isServerError, serverError, type ServerError } from '@/lib/errors';
import type {
  AddSectionEnrollmentInput,
  ListSectionEnrollmentsInput,
  RemoveSectionEnrollmentInput,
  UpdateSectionEnrollmentInput,
} from './academic-context';

type AdminSession = NonNullable<Awaited<ReturnType<typeof getSessionFromHeaders>>>;

const enrollmentProjection = {
  id: sectionEnrollments.id,
  sectionId: sectionEnrollments.sectionId,
  userId: sectionEnrollments.userId,
  role: sectionEnrollments.role,
  isActive: sectionEnrollments.isActive,
  startedAt: sectionEnrollments.startedAt,
  endedAt: sectionEnrollments.endedAt,
};

async function requireAdmin(): Promise<AdminSession | ServerError> {
  const session = await getSessionFromHeaders();
  if (!session) return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  if (!isAdmin(session)) return serverError(ErrorCode.FORBIDDEN, 'Forbidden');
  return session;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

function internalError(error: unknown, handler: string): ServerError {
  return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
    cause: error instanceof Error ? error.message : String(error),
    handler,
  });
}

function enrollmentError(error: unknown, handler: string): ServerError {
  if (isUniqueViolation(error))
    return serverError(ErrorCode.CONFLICT, 'User is already enrolled in this section');
  return internalError(error, handler);
}

export async function listSectionEnrollmentsHandler(args: { data: ListSectionEnrollmentsInput }) {
  const auth = await requireAdmin();
  if (isServerError(auth)) return auth;

  const { sectionId, page, limit, role, isActive } = args.data;
  const conditions = [eq(sectionEnrollments.sectionId, sectionId)];
  if (role) conditions.push(eq(sectionEnrollments.role, role));
  if (isActive !== undefined) conditions.push(eq(sectionEnrollments.isActive, isActive));
  try {
    const where = and(...conditions);
    const [enrollments, [{ count }]] = await Promise.all([
      getDb()
        .select({
          ...enrollmentProjection,
          userName: users.name,
          userEmail: users.email,
        })
        .from(sectionEnrollments)
        .innerJoin(users, eq(sectionEnrollments.userId, users.id))
        .where(and(where, isNull(users.deletedAt)))
        .orderBy(asc(users.name), asc(sectionEnrollments.userId))
        .limit(limit)
        .offset((page - 1) * limit),
      getDb()
        .select({ count: sql<number>`count(*)::int` })
        .from(sectionEnrollments)
        .innerJoin(users, eq(sectionEnrollments.userId, users.id))
        .where(and(where, isNull(users.deletedAt))),
    ]);
    return { enrollments, total: Number(count) };
  } catch (error) {
    return internalError(error, 'listSectionEnrollmentsHandler');
  }
}

export async function addSectionEnrollmentHandler(args: { data: AddSectionEnrollmentInput }) {
  const auth = await requireAdmin();
  if (isServerError(auth)) return auth;

  const { sectionId, userId, role, isActive } = args.data;
  const db = getDb();
  try {
    const result = await db.transaction(async (tx) => {
      const [section] = await tx
        .select({ id: courseSections.id, status: courseSections.status })
        .from(courseSections)
        .where(eq(courseSections.id, sectionId))
        .limit(1)
        .for('update');
      if (!section) return serverError(ErrorCode.NOT_FOUND, 'Course section not found');
      if (section.status === 'archived')
        return serverError(ErrorCode.CONFLICT, 'Archived section is immutable');

      const [user] = await tx
        .select({ id: users.id, role: users.role, deletedAt: users.deletedAt })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!user || user.deletedAt)
        return serverError(ErrorCode.BAD_REQUEST, 'User is inactive or not found');
      if (user.role !== role)
        return serverError(ErrorCode.BAD_REQUEST, 'User role does not match enrollment role');

      const [existing] = await tx
        .select({ id: sectionEnrollments.id })
        .from(sectionEnrollments)
        .where(
          and(eq(sectionEnrollments.sectionId, sectionId), eq(sectionEnrollments.userId, userId)),
        )
        .limit(1)
        .for('update');
      if (existing)
        return serverError(ErrorCode.CONFLICT, 'User is already enrolled in this section');

      const [enrollment] = await tx
        .insert(sectionEnrollments)
        .values({ sectionId, userId, role, isActive })
        .returning(enrollmentProjection);
      if (!enrollment)
        return internalError('Enrollment insert returned no row', 'addSectionEnrollmentHandler');
      return { enrollment };
    });

    if (!isServerError(result)) {
      await safeAuditLog('addSectionEnrollmentHandler', {
        actorId: auth.user.id,
        action: 'section_enrollment.added',
        entityType: 'section_enrollment',
        entityId: result.enrollment.id.toString(),
        details: { sectionId, userId, role },
      });
    }
    return result;
  } catch (error) {
    return enrollmentError(error, 'addSectionEnrollmentHandler');
  }
}

export async function updateSectionEnrollmentHandler(args: { data: UpdateSectionEnrollmentInput }) {
  const auth = await requireAdmin();
  if (isServerError(auth)) return auth;

  const { id, sectionId, role, isActive } = args.data;
  const db = getDb();
  try {
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: sectionEnrollments.id, userId: sectionEnrollments.userId })
        .from(sectionEnrollments)
        .where(and(eq(sectionEnrollments.id, id), eq(sectionEnrollments.sectionId, sectionId)))
        .limit(1)
        .for('update');
      if (!existing) return serverError(ErrorCode.NOT_FOUND, 'Section enrollment not found');

      const [user] = await tx
        .select({ id: users.id, role: users.role, deletedAt: users.deletedAt })
        .from(users)
        .where(eq(users.id, existing.userId))
        .limit(1);
      if (!user || user.deletedAt)
        return serverError(ErrorCode.BAD_REQUEST, 'User is inactive or not found');
      if (user.role !== role)
        return serverError(ErrorCode.BAD_REQUEST, 'User role does not match enrollment role');

      const [enrollment] = await tx
        .update(sectionEnrollments)
        .set({ role, isActive, endedAt: isActive ? null : new Date(), updatedAt: new Date() })
        .where(and(eq(sectionEnrollments.id, id), eq(sectionEnrollments.sectionId, sectionId)))
        .returning(enrollmentProjection);
      return { enrollment: enrollment ?? null };
    });

    if (!isServerError(result)) {
      await safeAuditLog('updateSectionEnrollmentHandler', {
        actorId: auth.user.id,
        action: 'section_enrollment.updated',
        entityType: 'section_enrollment',
        entityId: id.toString(),
        details: { sectionId, role, isActive },
      });
    }
    return result;
  } catch (error) {
    return internalError(error, 'updateSectionEnrollmentHandler');
  }
}

export async function removeSectionEnrollmentHandler(args: { data: RemoveSectionEnrollmentInput }) {
  const auth = await requireAdmin();
  if (isServerError(auth)) return auth;

  const { sectionId, userId } = args.data;
  const db = getDb();
  try {
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: sectionEnrollments.id })
        .from(sectionEnrollments)
        .where(
          and(eq(sectionEnrollments.sectionId, sectionId), eq(sectionEnrollments.userId, userId)),
        )
        .limit(1)
        .for('update');
      if (!existing) return serverError(ErrorCode.NOT_FOUND, 'Section enrollment not found');

      await tx
        .update(sectionEnrollments)
        .set({ isActive: false, endedAt: new Date(), updatedAt: new Date() })
        .where(eq(sectionEnrollments.id, existing.id));
      return { success: true };
    });

    if (!isServerError(result)) {
      await safeAuditLog('removeSectionEnrollmentHandler', {
        actorId: auth.user.id,
        action: 'section_enrollment.removed',
        entityType: 'section_enrollment',
        entityId: `${sectionId}:${userId}`,
      });
    }
    return result;
  } catch (error) {
    return internalError(error, 'removeSectionEnrollmentHandler');
  }
}
