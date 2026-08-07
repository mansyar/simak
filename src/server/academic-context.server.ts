import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { academicTerms, courseSections, courses } from '@/db/schema/academic-context';
import { getSessionFromHeaders } from './auth';
import { isAdmin } from '@/lib/session-guards';
import { safeAuditLog } from '@/lib/audit';
import { ErrorCode, isServerError, serverError, type ServerError } from '@/lib/errors';
import type {
  AcademicTermIdSchema,
  CreateAcademicTermInput,
  CreateCourseInput,
  CreateCourseSectionInput,
  CourseIdSchema,
  CourseSectionIdSchema,
  ListAcademicTermsInput,
  ListCourseSectionsInput,
  ListCoursesInput,
  UpdateAcademicTermInput,
  UpdateCourseSectionInput,
} from './academic-context';
import type { z } from 'zod';

type AcademicTermId = z.infer<typeof AcademicTermIdSchema>;
type CourseId = z.infer<typeof CourseIdSchema>;
type CourseSectionId = z.infer<typeof CourseSectionIdSchema>;
type AdminSession = NonNullable<Awaited<ReturnType<typeof getSessionFromHeaders>>>;

const termProjection = {
  id: academicTerms.id,
  code: academicTerms.code,
  name: academicTerms.name,
  startDate: academicTerms.startDate,
  endDate: academicTerms.endDate,
  status: academicTerms.status,
  createdAt: academicTerms.createdAt,
  updatedAt: academicTerms.updatedAt,
};

const courseProjection = {
  id: courses.id,
  code: courses.code,
  name: courses.name,
  description: courses.description,
  createdAt: courses.createdAt,
  updatedAt: courses.updatedAt,
};

const sectionProjection = {
  id: courseSections.id,
  termId: courseSections.termId,
  courseId: courseSections.courseId,
  code: courseSections.code,
  name: courseSections.name,
  status: courseSections.status,
  createdAt: courseSections.createdAt,
  updatedAt: courseSections.updatedAt,
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

function mutationError(error: unknown, handler: string, conflictMessage: string): ServerError {
  if (isUniqueViolation(error)) return serverError(ErrorCode.CONFLICT, conflictMessage);
  return internalError(error, handler);
}

function dateValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function whereOrUndefined(conditions: Parameters<typeof and>): ReturnType<typeof and> | undefined {
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function listAcademicTermsHandler(args: { data: ListAcademicTermsInput }) {
  const auth = await requireAdmin();
  if (isServerError(auth)) return auth;

  const { page, limit, search, status } = args.data;
  const conditions = [];
  if (status) conditions.push(eq(academicTerms.status, status));
  if (search) {
    conditions.push(
      or(ilike(academicTerms.code, `%${search}%`), ilike(academicTerms.name, `%${search}%`)),
    );
  }

  try {
    const where = whereOrUndefined(conditions);
    const [terms, [{ count }]] = await Promise.all([
      getDb()
        .select(termProjection)
        .from(academicTerms)
        .where(where)
        .orderBy(asc(academicTerms.startDate), asc(academicTerms.code))
        .limit(limit)
        .offset((page - 1) * limit),
      getDb()
        .select({ count: sql<number>`count(*)::int` })
        .from(academicTerms)
        .where(where),
    ]);
    return { terms, total: Number(count) };
  } catch (error) {
    return internalError(error, 'listAcademicTermsHandler');
  }
}

export async function getAcademicTermHandler(args: { data: AcademicTermId }) {
  const auth = await requireAdmin();
  if (isServerError(auth)) return auth;

  try {
    const [term] = await getDb()
      .select(termProjection)
      .from(academicTerms)
      .where(eq(academicTerms.id, args.data.id))
      .limit(1);
    return { term: term ?? null };
  } catch (error) {
    return internalError(error, 'getAcademicTermHandler');
  }
}

export async function createAcademicTermHandler(args: { data: CreateAcademicTermInput }) {
  const auth = await requireAdmin();
  if (isServerError(auth)) return auth;

  const db = getDb();
  const { code, name, startDate, endDate, status } = args.data;
  try {
    const [existing] = await db
      .select({ id: academicTerms.id })
      .from(academicTerms)
      .where(eq(academicTerms.code, code))
      .limit(1);
    if (existing) return serverError(ErrorCode.CONFLICT, 'Academic term code already exists');

    const [term] = await db
      .insert(academicTerms)
      .values({ code, name, startDate: dateValue(startDate), endDate: dateValue(endDate), status })
      .returning(termProjection);
    if (!term)
      return internalError('Academic term insert returned no row', 'createAcademicTermHandler');

    await safeAuditLog('createAcademicTermHandler', {
      actorId: auth.user.id,
      action: 'academic_term.created',
      entityType: 'academic_term',
      entityId: term.id.toString(),
      details: { code, status },
    });
    return { term };
  } catch (error) {
    return mutationError(error, 'createAcademicTermHandler', 'Academic term code already exists');
  }
}

export async function updateAcademicTermHandler(args: { data: UpdateAcademicTermInput }) {
  const auth = await requireAdmin();
  if (isServerError(auth)) return auth;

  const { id, code, name, startDate, endDate, status } = args.data;
  try {
    const [existing] = await getDb()
      .select({ id: academicTerms.id, status: academicTerms.status })
      .from(academicTerms)
      .where(eq(academicTerms.id, id))
      .limit(1);
    if (!existing) return serverError(ErrorCode.NOT_FOUND, 'Academic term not found');
    if (existing.status === 'archived')
      return serverError(ErrorCode.CONFLICT, 'Archived term is immutable');

    const [term] = await getDb()
      .update(academicTerms)
      .set({
        code,
        name,
        startDate: dateValue(startDate),
        endDate: dateValue(endDate),
        status,
        archivedAt: status === 'archived' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(academicTerms.id, id))
      .returning(termProjection);
    if (!term)
      return internalError('Academic term update returned no row', 'updateAcademicTermHandler');
    await safeAuditLog('updateAcademicTermHandler', {
      actorId: auth.user.id,
      action: 'academic_term.updated',
      entityType: 'academic_term',
      entityId: id.toString(),
      details: { code, status },
    });
    return { term: term ?? null };
  } catch (error) {
    return mutationError(error, 'updateAcademicTermHandler', 'Academic term code already exists');
  }
}

export async function listCoursesHandler(args: { data: ListCoursesInput }) {
  const auth = await requireAdmin();
  if (isServerError(auth)) return auth;

  const { page, limit, search } = args.data;
  const where = search
    ? or(ilike(courses.code, `%${search}%`), ilike(courses.name, `%${search}%`))
    : undefined;
  try {
    const [courseRows, [{ count }]] = await Promise.all([
      getDb()
        .select(courseProjection)
        .from(courses)
        .where(where)
        .orderBy(asc(courses.code))
        .limit(limit)
        .offset((page - 1) * limit),
      getDb()
        .select({ count: sql<number>`count(*)::int` })
        .from(courses)
        .where(where),
    ]);
    return { courses: courseRows, total: Number(count) };
  } catch (error) {
    return internalError(error, 'listCoursesHandler');
  }
}

export async function getCourseHandler(args: { data: CourseId }) {
  const auth = await requireAdmin();
  if (isServerError(auth)) return auth;
  try {
    const [course] = await getDb()
      .select(courseProjection)
      .from(courses)
      .where(eq(courses.id, args.data.id))
      .limit(1);
    return { course: course ?? null };
  } catch (error) {
    return internalError(error, 'getCourseHandler');
  }
}

export async function createCourseHandler(args: { data: CreateCourseInput }) {
  const auth = await requireAdmin();
  if (isServerError(auth)) return auth;
  const { code, name, description } = args.data;
  try {
    const [existing] = await getDb()
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.code, code))
      .limit(1);
    if (existing) return serverError(ErrorCode.CONFLICT, 'Course code already exists');
    const [course] = await getDb()
      .insert(courses)
      .values({ code, name, description })
      .returning(courseProjection);
    if (!course) return internalError('Course insert returned no row', 'createCourseHandler');
    await safeAuditLog('createCourseHandler', {
      actorId: auth.user.id,
      action: 'course.created',
      entityType: 'course',
      entityId: course.id.toString(),
      details: { code },
    });
    return { course };
  } catch (error) {
    return mutationError(error, 'createCourseHandler', 'Course code already exists');
  }
}

export async function updateCourseHandler(args: { data: CreateCourseInput & CourseId }) {
  const auth = await requireAdmin();
  if (isServerError(auth)) return auth;
  const { id, code, name, description } = args.data;
  try {
    const [existing] = await getDb()
      .select({ id: courses.id, archivedAt: courses.archivedAt })
      .from(courses)
      .where(eq(courses.id, id))
      .limit(1);
    if (!existing) return serverError(ErrorCode.NOT_FOUND, 'Course not found');
    if (existing.archivedAt) return serverError(ErrorCode.CONFLICT, 'Archived course is immutable');
    const [course] = await getDb()
      .update(courses)
      .set({ code, name, description, updatedAt: new Date() })
      .where(eq(courses.id, id))
      .returning(courseProjection);
    if (!course) return internalError('Course update returned no row', 'updateCourseHandler');
    await safeAuditLog('updateCourseHandler', {
      actorId: auth.user.id,
      action: 'course.updated',
      entityType: 'course',
      entityId: id.toString(),
      details: { code },
    });
    return { course: course ?? null };
  } catch (error) {
    return mutationError(error, 'updateCourseHandler', 'Course code already exists');
  }
}

export async function listCourseSectionsHandler(args: { data: ListCourseSectionsInput }) {
  const auth = await requireAdmin();
  if (isServerError(auth)) return auth;
  const { page, limit, termId, courseId, status, search } = args.data;
  const conditions = [];
  if (termId) conditions.push(eq(courseSections.termId, termId));
  if (courseId) conditions.push(eq(courseSections.courseId, courseId));
  if (status) conditions.push(eq(courseSections.status, status));
  if (search)
    conditions.push(
      or(ilike(courseSections.code, `%${search}%`), ilike(courseSections.name, `%${search}%`)),
    );
  try {
    const where = whereOrUndefined(conditions);
    const [sections, [{ count }]] = await Promise.all([
      getDb()
        .select(sectionProjection)
        .from(courseSections)
        .where(where)
        .orderBy(asc(courseSections.code))
        .limit(limit)
        .offset((page - 1) * limit),
      getDb()
        .select({ count: sql<number>`count(*)::int` })
        .from(courseSections)
        .where(where),
    ]);
    return { sections, total: Number(count) };
  } catch (error) {
    return internalError(error, 'listCourseSectionsHandler');
  }
}

export async function getCourseSectionHandler(args: { data: CourseSectionId }) {
  const auth = await requireAdmin();
  if (isServerError(auth)) return auth;
  try {
    const [section] = await getDb()
      .select(sectionProjection)
      .from(courseSections)
      .where(eq(courseSections.id, args.data.id))
      .limit(1);
    return { section: section ?? null };
  } catch (error) {
    return internalError(error, 'getCourseSectionHandler');
  }
}

export async function createCourseSectionHandler(args: { data: CreateCourseSectionInput }) {
  const auth = await requireAdmin();
  if (isServerError(auth)) return auth;
  const { termId, courseId, code, name, status } = args.data;
  try {
    const [existing] = await getDb()
      .select({ id: courseSections.id })
      .from(courseSections)
      .where(
        and(
          eq(courseSections.termId, termId),
          eq(courseSections.courseId, courseId),
          eq(courseSections.code, code),
        ),
      )
      .limit(1);
    if (existing) return serverError(ErrorCode.CONFLICT, 'Course section identity already exists');
    const [term] = await getDb()
      .select({ id: academicTerms.id, status: academicTerms.status })
      .from(academicTerms)
      .where(eq(academicTerms.id, termId))
      .limit(1);
    const [course] = await getDb()
      .select({ id: courses.id, archivedAt: courses.archivedAt })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    if (!term || !course) return serverError(ErrorCode.NOT_FOUND, 'Term or course not found');
    if (term.status === 'archived' || course.archivedAt)
      return serverError(ErrorCode.CONFLICT, 'Archived context cannot receive sections');
    const [section] = await getDb()
      .insert(courseSections)
      .values({ termId, courseId, code, name, status })
      .returning(sectionProjection);
    if (!section)
      return internalError('Course section insert returned no row', 'createCourseSectionHandler');
    await safeAuditLog('createCourseSectionHandler', {
      actorId: auth.user.id,
      action: 'course_section.created',
      entityType: 'course_section',
      entityId: section.id.toString(),
      details: { termId, courseId, code },
    });
    return { section };
  } catch (error) {
    return mutationError(
      error,
      'createCourseSectionHandler',
      'Course section identity already exists',
    );
  }
}

export async function updateCourseSectionHandler(args: { data: UpdateCourseSectionInput }) {
  const auth = await requireAdmin();
  if (isServerError(auth)) return auth;
  const { id, termId, courseId, code, name, status } = args.data;
  try {
    const [existing] = await getDb()
      .select({ id: courseSections.id, status: courseSections.status })
      .from(courseSections)
      .where(eq(courseSections.id, id))
      .limit(1);
    if (!existing) return serverError(ErrorCode.NOT_FOUND, 'Course section not found');
    if (existing.status === 'archived')
      return serverError(ErrorCode.CONFLICT, 'Archived section is immutable');
    const [context] = await getDb()
      .select({ termStatus: academicTerms.status, courseArchivedAt: courses.archivedAt })
      .from(academicTerms)
      .innerJoin(courses, eq(courses.id, courseId))
      .where(eq(academicTerms.id, termId))
      .limit(1);
    if (!context) return serverError(ErrorCode.NOT_FOUND, 'Term or course not found');
    if (context.termStatus === 'archived' || context.courseArchivedAt)
      return serverError(ErrorCode.CONFLICT, 'Archived context cannot receive sections');
    const [section] = await getDb()
      .update(courseSections)
      .set({
        termId,
        courseId,
        code,
        name,
        status,
        archivedAt: status === 'archived' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(courseSections.id, id))
      .returning(sectionProjection);
    if (!section)
      return internalError('Course section update returned no row', 'updateCourseSectionHandler');
    await safeAuditLog('updateCourseSectionHandler', {
      actorId: auth.user.id,
      action: 'course_section.updated',
      entityType: 'course_section',
      entityId: id.toString(),
      details: { termId, courseId, code, status },
    });
    return { section: section ?? null };
  } catch (error) {
    return mutationError(
      error,
      'updateCourseSectionHandler',
      'Course section identity already exists',
    );
  }
}

export {
  archiveAcademicTermHandler,
  archiveCourseHandler,
  archiveCourseSectionHandler,
} from './academic-context-archive.server';

export {
  listSectionEnrollmentsHandler,
  addSectionEnrollmentHandler,
  updateSectionEnrollmentHandler,
  removeSectionEnrollmentHandler,
} from './academic-context-enrollments.server';
