// Server-only handlers for consultation operations
import { eq, and, desc, asc, sql, isNull } from 'drizzle-orm';
import { getDb } from '../db/index';
import { consultations } from '../db/schema/consultations';
import { checkpoints, assignments, assignmentStudents } from '../db/schema/assignments';
import { notifications } from '../db/schema/notifications';
import { users } from '../db/schema/users';
import { getSessionFromHeaders } from './auth';
import { logAuditEvent } from '../lib/audit';
import { serverError, ErrorCode } from '../lib/errors';
import { verifyAssignmentAccess } from './ownership';
import { getNotificationKeys, resolveNotificationContent } from './notifications.server';
import type { NonNullableSession } from '../lib/types';
import type { z } from 'zod';
import type {
  LogConsultationSchema,
  ListConsultationsSchema,
  ListPendingConsultationsSchema,
  VerifyConsultationSchema,
  RejectConsultationSchema,
  GetConsultationDetailSchema,
} from './consultations';

type LogConsultationInput = z.infer<typeof LogConsultationSchema>;
type ListConsultationsInput = z.infer<typeof ListConsultationsSchema>;
type ListPendingConsultationsInput = z.infer<typeof ListPendingConsultationsSchema>;
type VerifyConsultationInput = z.infer<typeof VerifyConsultationSchema>;
type RejectConsultationInput = z.infer<typeof RejectConsultationSchema>;
type GetConsultationDetailInput = z.infer<typeof GetConsultationDetailSchema>;

function isStudent(session: NonNullableSession | null): session is NonNullableSession {
  return !!session && session.user.role === 'student';
}

function isInstructor(session: NonNullableSession | null): session is NonNullableSession {
  return !!session && session.user.role === 'instructor';
}

/**
 * Student logs a consultation session tied to a specific checkpoint.
 * Validates student is assigned to the assignment and checkpoint belongs to them.
 */
export async function logConsultationHandler(args: { data: LogConsultationInput }) {
  const session = await getSessionFromHeaders();
  if (!isStudent(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { checkpointId, sessionType, externalConsultantName, notes } = args.data;
  const db = getDb();

  try {
    // 1. Verify the checkpoint belongs to this student via assignmentStudents
    const [checkpoint] = await db
      .select({
        id: checkpoints.id,
        assignmentId: checkpoints.assignmentId,
        studentId: checkpoints.studentId,
        assignmentInstructorId: assignments.instructorId,
      })
      .from(checkpoints)
      .innerJoin(assignments, eq(checkpoints.assignmentId, assignments.id))
      .innerJoin(assignmentStudents, eq(checkpoints.assignmentId, assignmentStudents.assignmentId))
      .where(
        and(
          eq(checkpoints.id, checkpointId),
          eq(checkpoints.studentId, session.user.id),
          eq(assignmentStudents.studentId, session.user.id),
          isNull(assignments.deletedAt),
        ),
      )
      .limit(1);

    if (!checkpoint) {
      return serverError(ErrorCode.NOT_FOUND, 'Checkpoint not found');
    }

    // 2. Insert consultation record with pending status
    const [inserted] = await db
      .insert(consultations)
      .values({
        assignmentId: checkpoint.assignmentId,
        checkpointId,
        studentId: session.user.id,
        status: 'pending',
        sessionType,
        externalConsultantName:
          sessionType === 'external' ? (externalConsultantName ?? null) : null,
        notes,
      })
      .returning({ id: consultations.id });

    // 3. Create in-app notification for the instructor
    const loggedKeys = getNotificationKeys('consultation_logged');
    const loggedContent = resolveNotificationContent(
      loggedKeys.titleKey,
      loggedKeys.messageKey,
      { sessionType: sessionType ?? 'general' },
      'en',
    );
    await db.insert(notifications).values({
      userId: checkpoint.assignmentInstructorId,
      type: 'consultation_logged',
      title: loggedContent.title,
      message: loggedContent.message,
      titleKey: loggedKeys.titleKey,
      messageKey: loggedKeys.messageKey,
      params: { sessionType: sessionType ?? 'general' },
      channel: 'in_app',
      metadata: {
        consultationId: inserted.id,
        checkpointId,
        assignmentId: checkpoint.assignmentId,
      },
    });

    return { consultation: { id: inserted.id } };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'logConsultationHandler',
    });
  }
}

/**
 * List consultations for a student's assignment.
 * Students see only their own consultations; instructors see all for their assignments.
 */
export async function listConsultationsHandler(args: { data: ListConsultationsInput }) {
  const session = await getSessionFromHeaders();
  if (!session) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { assignmentId, checkpointId } = args.data;
  const db = getDb();

  try {
    const role = session.user.role;
    const accessError = await verifyAssignmentAccess(db, assignmentId, session);
    if (accessError) return accessError;

    // Common conditions
    const conditions = [eq(consultations.assignmentId, assignmentId)];
    if (checkpointId) conditions.push(eq(consultations.checkpointId, checkpointId));
    if (role === 'student') conditions.push(eq(consultations.studentId, session.user.id));

    const baseQuery = db
      .select({
        id: consultations.id,
        checkpointId: consultations.checkpointId,
        sessionType: consultations.sessionType,
        externalConsultantName: consultations.externalConsultantName,
        notes: consultations.notes,
        status: consultations.status,
        checkpointName: checkpoints.name,
        createdAt: consultations.createdAt,
        ...(role === 'instructor'
          ? { studentId: consultations.studentId, studentName: users.name }
          : {}),
      })
      .from(consultations)
      .innerJoin(checkpoints, eq(consultations.checkpointId, checkpoints.id));

    const query =
      role === 'instructor'
        ? baseQuery.innerJoin(users, eq(consultations.studentId, users.id))
        : baseQuery;

    const items = await query.where(and(...conditions)).orderBy(desc(consultations.createdAt));

    return { consultations: items };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'listConsultationsHandler',
    });
  }
}

/**
 * Get full consultation details for the verification dialog.
 * Only accessible by the assignment instructor.
 */
export async function getConsultationDetailHandler(args: { data: GetConsultationDetailInput }) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { consultationId } = args.data;
  const db = getDb();

  try {
    const [consultation] = await db
      .select({
        id: consultations.id,
        assignmentId: consultations.assignmentId,
        checkpointId: consultations.checkpointId,
        studentId: consultations.studentId,
        sessionType: consultations.sessionType,
        externalConsultantName: consultations.externalConsultantName,
        notes: consultations.notes,
        status: consultations.status,
        verifiedById: consultations.verifiedById,
        verifiedAt: consultations.verifiedAt,
        createdAt: consultations.createdAt,
        studentName: users.name,
        studentEmail: users.email,
        checkpointName: checkpoints.name,
        instructorId: assignments.instructorId,
      })
      .from(consultations)
      .innerJoin(checkpoints, eq(consultations.checkpointId, checkpoints.id))
      .innerJoin(assignments, eq(consultations.assignmentId, assignments.id))
      .innerJoin(users, eq(consultations.studentId, users.id))
      .where(
        and(
          eq(consultations.id, consultationId),
          eq(assignments.instructorId, session.user.id),
          isNull(assignments.deletedAt),
        ),
      )
      .limit(1);

    if (!consultation) {
      return serverError(ErrorCode.NOT_FOUND, 'Consultation not found');
    }

    return { consultation };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'getConsultationDetailHandler',
    });
  }
}

/**
 * List pending consultations for the instructor's assignment queue.
 * Ordered by oldest first (FIFO).
 */
export async function listPendingConsultationsHandler(args: {
  data: ListPendingConsultationsInput;
}) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { assignmentId } = args.data;
  const db = getDb();

  try {
    // Verify instructor owns this assignment
    const [assignment] = await db
      .select({ id: assignments.id })
      .from(assignments)
      .where(
        and(
          eq(assignments.id, assignmentId),
          eq(assignments.instructorId, session.user.id),
          isNull(assignments.deletedAt),
        ),
      )
      .limit(1);

    if (!assignment) {
      return serverError(ErrorCode.NOT_FOUND, 'Assignment not found');
    }

    const items = await db
      .select({
        id: consultations.id,
        checkpointId: consultations.checkpointId,
        studentId: consultations.studentId,
        sessionType: consultations.sessionType,
        externalConsultantName: consultations.externalConsultantName,
        notes: consultations.notes,
        createdAt: consultations.createdAt,
        studentName: users.name,
        checkpointName: checkpoints.name,
      })
      .from(consultations)
      .innerJoin(checkpoints, eq(consultations.checkpointId, checkpoints.id))
      .innerJoin(users, eq(consultations.studentId, users.id))
      .where(and(eq(consultations.assignmentId, assignmentId), eq(consultations.status, 'pending')))
      .orderBy(asc(consultations.createdAt));

    return { consultations: items };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'listPendingConsultationsHandler',
    });
  }
}

/**
 * Instructor verifies a consultation.
 * Sets status to verified, records who verified it and when.
 */
export async function verifyConsultationHandler(args: { data: VerifyConsultationInput }) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { consultationId } = args.data;
  const db = getDb();

  try {
    // 1. Fetch consultation with assignment ownership check
    const [consultation] = await db
      .select({
        id: consultations.id,
        status: consultations.status,
        studentId: consultations.studentId,
        assignmentId: consultations.assignmentId,
        instructorId: assignments.instructorId,
      })
      .from(consultations)
      .innerJoin(assignments, eq(consultations.assignmentId, assignments.id))
      .where(
        and(
          eq(consultations.id, consultationId),
          eq(assignments.instructorId, session.user.id),
          isNull(assignments.deletedAt),
        ),
      )
      .limit(1);

    if (!consultation) {
      return serverError(ErrorCode.NOT_FOUND, 'Consultation not found');
    }

    if (consultation.status !== 'pending') {
      return serverError(ErrorCode.BAD_REQUEST, 'Consultation is not in pending state');
    }

    // 2. Update status and notify the student inside a transaction
    await db.transaction(async (tx) => {
      await tx
        .update(consultations)
        .set({
          status: 'verified',
          verifiedById: session.user.id,
          verifiedAt: new Date(),
        })
        .where(eq(consultations.id, consultationId));

      const verifiedKeys = getNotificationKeys('consultation_verified');
      const verifiedContent = resolveNotificationContent(
        verifiedKeys.titleKey,
        verifiedKeys.messageKey,
        null,
        'en',
      );
      await tx.insert(notifications).values({
        userId: consultation.studentId,
        type: 'consultation_verified',
        title: verifiedContent.title,
        message: verifiedContent.message,
        titleKey: verifiedKeys.titleKey,
        messageKey: verifiedKeys.messageKey,
        params: null,
        channel: 'in_app',
        metadata: {
          consultationId,
          assignmentId: consultation.assignmentId,
        },
      });
    });

    // 3. Audit log after commit (advisory work; must not fail the committed transaction)
    try {
      await logAuditEvent({
        actorId: session.user.id,
        action: 'consultation.verified',
        entityType: 'consultation',
        entityId: String(consultationId),
        details: { checkpoint: consultation.assignmentId, student: consultation.studentId },
      });
    } catch (err) {
      console.error('Failed to log consultation verified audit event:', err);
    }

    return { success: true };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'verifyConsultationHandler',
    });
  }
}

/**
 * Instructor rejects a consultation with a reason.
 */
export async function rejectConsultationHandler(args: { data: RejectConsultationInput }) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { consultationId, reason } = args.data;
  const db = getDb();

  try {
    // 1. Fetch consultation with assignment ownership check
    const [consultation] = await db
      .select({
        id: consultations.id,
        status: consultations.status,
        studentId: consultations.studentId,
        assignmentId: consultations.assignmentId,
        instructorId: assignments.instructorId,
      })
      .from(consultations)
      .innerJoin(assignments, eq(consultations.assignmentId, assignments.id))
      .where(
        and(
          eq(consultations.id, consultationId),
          eq(assignments.instructorId, session.user.id),
          isNull(assignments.deletedAt),
        ),
      )
      .limit(1);

    if (!consultation) {
      return serverError(ErrorCode.NOT_FOUND, 'Consultation not found');
    }

    if (consultation.status !== 'pending') {
      return serverError(ErrorCode.BAD_REQUEST, 'Consultation is not in pending state');
    }

    // 2. Update status to rejected with reason and notify the student inside a transaction
    await db.transaction(async (tx) => {
      await tx
        .update(consultations)
        .set({
          status: 'rejected',
          verifiedById: session.user.id,
          verifiedAt: new Date(),
          notes: sql`CASE WHEN ${consultations.notes} IS NULL THEN ${reason} ELSE ${consultations.notes} || E'\n\nRejection reason: ' || ${reason} END`,
        })
        .where(eq(consultations.id, consultationId));

      const rejectedParams = { reason };
      const rejectedKeys = getNotificationKeys('consultation_rejected');
      const rejectedContent = resolveNotificationContent(
        rejectedKeys.titleKey,
        rejectedKeys.messageKey,
        rejectedParams,
        'en',
      );
      await tx.insert(notifications).values({
        userId: consultation.studentId,
        type: 'consultation_rejected',
        title: rejectedContent.title,
        message: rejectedContent.message,
        titleKey: rejectedKeys.titleKey,
        messageKey: rejectedKeys.messageKey,
        params: rejectedParams,
        channel: 'in_app',
        metadata: {
          consultationId,
          assignmentId: consultation.assignmentId,
          rejectionReason: reason,
        },
      });
    });

    // 3. Audit log after commit (advisory work; must not fail the committed transaction)
    try {
      await logAuditEvent({
        actorId: session.user.id,
        action: 'consultation.rejected',
        entityType: 'consultation',
        entityId: String(consultationId),
        details: { checkpoint: consultation.assignmentId, student: consultation.studentId, reason },
      });
    } catch (err) {
      console.error('Failed to log consultation rejected audit event:', err);
    }

    return { success: true };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'rejectConsultationHandler',
    });
  }
}

export { listVerifiedCountsHandler } from './consultations-extras.server';
