import { eq } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { academicTerms, courseSections, courses } from '@/db/schema/academic-context';
import { getSessionFromHeaders } from './auth';
import { isAdmin } from '@/lib/session-guards';
import { safeAuditLog } from '@/lib/audit';
import { ErrorCode, isServerError, serverError, type ServerError } from '@/lib/errors';
import type {
  AcademicTermIdSchema,
  CourseIdSchema,
  CourseSectionIdSchema,
} from './academic-context';
import type { z } from 'zod';

type AcademicTermId = z.infer<typeof AcademicTermIdSchema>;
type CourseId = z.infer<typeof CourseIdSchema>;
type CourseSectionId = z.infer<typeof CourseSectionIdSchema>;
type AdminSession = NonNullable<Awaited<ReturnType<typeof getSessionFromHeaders>>>;

async function requireAdmin(): Promise<AdminSession | ServerError> {
  const session = await getSessionFromHeaders();
  if (!session) return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  if (!isAdmin(session)) return serverError(ErrorCode.FORBIDDEN, 'Forbidden');
  return session;
}

function internalError(error: unknown, handler: string): ServerError {
  return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
    cause: error instanceof Error ? error.message : String(error),
    handler,
  });
}

export async function archiveAcademicTermHandler(args: { data: AcademicTermId }) {
  const auth = await requireAdmin();
  if (isServerError(auth)) return auth;

  try {
    const [existing] = await getDb()
      .select({ id: academicTerms.id, status: academicTerms.status })
      .from(academicTerms)
      .where(eq(academicTerms.id, args.data.id))
      .limit(1);
    if (!existing) return serverError(ErrorCode.NOT_FOUND, 'Academic term not found');
    await getDb()
      .update(academicTerms)
      .set({ status: 'archived', archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(academicTerms.id, args.data.id));
    await safeAuditLog('archiveAcademicTermHandler', {
      actorId: auth.user.id,
      action: 'academic_term.archived',
      entityType: 'academic_term',
      entityId: args.data.id.toString(),
    });
    return { success: true };
  } catch (error) {
    return internalError(error, 'archiveAcademicTermHandler');
  }
}

export async function archiveCourseHandler(args: { data: CourseId }) {
  const auth = await requireAdmin();
  if (isServerError(auth)) return auth;
  try {
    const [existing] = await getDb()
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.id, args.data.id))
      .limit(1);
    if (!existing) return serverError(ErrorCode.NOT_FOUND, 'Course not found');
    await getDb()
      .update(courses)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(courses.id, args.data.id));
    await safeAuditLog('archiveCourseHandler', {
      actorId: auth.user.id,
      action: 'course.archived',
      entityType: 'course',
      entityId: args.data.id.toString(),
    });
    return { success: true };
  } catch (error) {
    return internalError(error, 'archiveCourseHandler');
  }
}

export async function archiveCourseSectionHandler(args: { data: CourseSectionId }) {
  const auth = await requireAdmin();
  if (isServerError(auth)) return auth;
  try {
    const [existing] = await getDb()
      .select({ id: courseSections.id, status: courseSections.status })
      .from(courseSections)
      .where(eq(courseSections.id, args.data.id))
      .limit(1);
    if (!existing) return serverError(ErrorCode.NOT_FOUND, 'Course section not found');
    await getDb()
      .update(courseSections)
      .set({ status: 'archived', archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(courseSections.id, args.data.id));
    await safeAuditLog('archiveCourseSectionHandler', {
      actorId: auth.user.id,
      action: 'course_section.archived',
      entityType: 'course_section',
      entityId: args.data.id.toString(),
    });
    return { success: true };
  } catch (error) {
    return internalError(error, 'archiveCourseSectionHandler');
  }
}
