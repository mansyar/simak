// Server-only handlers for consultation operations
import { eq, and, desc, asc, sql, isNull } from 'drizzle-orm';
import { getDb } from '../db/index';
import type { Db } from '../db/index';
import { consultations } from '../db/schema/consultations';
import { checkpoints, assignments, assignmentStudents } from '../db/schema/assignments';
import { users } from '../db/schema/users';
import { getSessionFromHeaders } from './auth';
import { logAuditEvent } from '../lib/audit';
import { serverError, ErrorCode, type ServerError } from '../lib/errors';
import { verifyAssignmentAccess } from './ownership';
import { getNotificationKeys } from './notifications.server';
import { sendConsultationEmail } from '../lib/consultation-email';
import { maybeInsertNotification } from '../lib/notification-prefs';
import { isStudent, isInstructor } from '../lib/session-guards';
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

export type PendingConsultationItem = {
  id: number;
  checkpointId: number;
  studentId: string;
  sessionType: string | null;
  externalConsultantName: string | null;
  notes: string | null;
  createdAt: string;
  studentName: string;
  checkpointName: string;
};

export type ListPendingConsultationsSuccess = {
  consultations: PendingConsultationItem[];
  total: number;
};

/** Student logs a consultation session tied to a specific checkpoint. */
export async function logConsultationHandler(args: { data: LogConsultationInput }) {
  const session = await getSessionFromHeaders();
  if (!isStudent(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { checkpointId, sessionType, externalConsultantName, notes } = args.data;
  const db = getDb();

  try {
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

    const loggedKeys = getNotificationKeys('consultation_logged');
    await maybeInsertNotification(db, checkpoint.assignmentInstructorId, 'consultation_logged', {
      userId: checkpoint.assignmentInstructorId,
      type: 'consultation_logged',
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

/** List consultations for an assignment (students see own; instructors see all). */
export async function listConsultationsHandler(args: { data: ListConsultationsInput }) {
  const session = await getSessionFromHeaders();
  if (!session) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { assignmentId, checkpointId, page = 1, limit = 20 } = args.data;
  const db = getDb();

  try {
    const role = session.user.role;
    const accessError = await verifyAssignmentAccess(db, assignmentId, session);
    if (accessError) return accessError;
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

    const [items, [{ count }]] = await Promise.all([
      query
        .where(and(...conditions))
        .orderBy(desc(consultations.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(consultations)
        .where(and(...conditions)),
    ]);

    return { consultations: items, total: Number(count) };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'listConsultationsHandler',
    });
  }
}

/** Get full consultation details for the verification dialog (instructor only). */
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

/** List pending consultations for the instructor's queue (FIFO). */
export async function listPendingConsultationsHandler(args: {
  data: ListPendingConsultationsInput;
}): Promise<ListPendingConsultationsSuccess | ServerError> {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { assignmentId, page = 1, limit = 20 } = args.data;
  const db = getDb();

  try {
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

    const conditions = and(
      eq(consultations.assignmentId, assignmentId),
      eq(consultations.status, 'pending'),
    );

    const [items, [{ count }]] = await Promise.all([
      db
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
        .where(conditions)
        .orderBy(asc(consultations.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(consultations)
        .where(conditions),
    ]);

    return {
      consultations: items.map((item) => ({
        ...item,
        createdAt: item.createdAt ? item.createdAt.toISOString() : '',
      })),
      total: Number(count),
    };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'listPendingConsultationsHandler',
    });
  }
}
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

async function fetchConsultationForUpdate(tx: Tx, consultationId: number, instructorId: string) {
  return tx
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
        eq(assignments.instructorId, instructorId),
        isNull(assignments.deletedAt),
      ),
    )
    .limit(1)
    .for('update', { of: consultations });
}

export async function verifyConsultationHandler(args: { data: VerifyConsultationInput }) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { consultationId } = args.data;
  const db = getDb();

  try {
    let auditData: { assignmentId: number; studentId: string } | undefined;

    const result = await db.transaction(async (tx) => {
      const [consultation] = await fetchConsultationForUpdate(tx, consultationId, session.user.id);

      if (!consultation) {
        return serverError(ErrorCode.NOT_FOUND, 'Consultation not found');
      }

      if (consultation.status !== 'pending') {
        return serverError(ErrorCode.BAD_REQUEST, 'Consultation has already been processed');
      }

      await tx
        .update(consultations)
        .set({
          status: 'verified',
          verifiedById: session.user.id,
          verifiedAt: new Date(),
        })
        .where(eq(consultations.id, consultationId));

      const verifiedKeys = getNotificationKeys('consultation_verified');
      await maybeInsertNotification(tx, consultation.studentId, 'consultation_verified', {
        userId: consultation.studentId,
        type: 'consultation_verified',
        titleKey: verifiedKeys.titleKey,
        messageKey: verifiedKeys.messageKey,
        params: null,
        channel: 'in_app',
        metadata: { consultationId, assignmentId: consultation.assignmentId },
      });

      auditData = { assignmentId: consultation.assignmentId, studentId: consultation.studentId };

      return { success: true };
    });

    if (auditData) {
      try {
        await logAuditEvent({
          actorId: session.user.id,
          action: 'consultation.verified',
          entityType: 'consultation',
          entityId: String(consultationId),
          details: { checkpoint: auditData.assignmentId, student: auditData.studentId },
        });
      } catch (err) {
        console.error('Failed to log consultation verified audit event:', err);
      }
      await sendConsultationEmail(auditData, session.user.name, consultationId, true);
    }

    return result;
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'verifyConsultationHandler',
    });
  }
}

export async function rejectConsultationHandler(args: { data: RejectConsultationInput }) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { consultationId, reason } = args.data;
  const db = getDb();

  try {
    let auditData: { assignmentId: number; studentId: string } | undefined;

    const result = await db.transaction(async (tx) => {
      const [consultation] = await fetchConsultationForUpdate(tx, consultationId, session.user.id);

      if (!consultation) {
        return serverError(ErrorCode.NOT_FOUND, 'Consultation not found');
      }

      if (consultation.status !== 'pending') {
        return serverError(ErrorCode.BAD_REQUEST, 'Consultation has already been processed');
      }

      await tx
        .update(consultations)
        .set({
          status: 'rejected',
          verifiedById: session.user.id,
          verifiedAt: new Date(),
          notes: sql`CASE WHEN ${consultations.notes} IS NULL THEN ${reason} ELSE ${consultations.notes} || E'\n\nRejection reason: ' || ${reason} END`,
        })
        .where(eq(consultations.id, consultationId));

      const rejectedKeys = getNotificationKeys('consultation_rejected');
      await maybeInsertNotification(tx, consultation.studentId, 'consultation_rejected', {
        userId: consultation.studentId,
        type: 'consultation_rejected',
        titleKey: rejectedKeys.titleKey,
        messageKey: rejectedKeys.messageKey,
        params: { reason },
        channel: 'in_app',
        metadata: {
          consultationId,
          assignmentId: consultation.assignmentId,
          rejectionReason: reason,
        },
      });

      auditData = { assignmentId: consultation.assignmentId, studentId: consultation.studentId };

      return { success: true };
    });

    if (auditData) {
      try {
        await logAuditEvent({
          actorId: session.user.id,
          action: 'consultation.rejected',
          entityType: 'consultation',
          entityId: String(consultationId),
          details: { checkpoint: auditData.assignmentId, student: auditData.studentId, reason },
        });
      } catch (err) {
        console.error('Failed to log consultation rejected audit event:', err);
      }
      await sendConsultationEmail(auditData, session.user.name, consultationId, false, reason);
    }

    return result;
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'rejectConsultationHandler',
    });
  }
}

export { listVerifiedCountsHandler } from './consultations-extras.server';
