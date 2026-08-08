// Server-only appointment handlers. This module must never be imported by client code.
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { getDb, type Db } from '@/db/index';
import { appointments } from '@/db/schema/appointments';
import { assignments, checkpoints } from '@/db/schema/assignments';
import { academicTerms, courseSections, sectionEnrollments } from '@/db/schema/academic-context';
import { users } from '@/db/schema/users';
import {
  appointmentStatusSchema,
  canTransitionAppointment,
  validateAppointmentWindow,
} from '@/lib/appointment-policies';
import { safeAuditLog } from '@/lib/audit';
import { ErrorCode, serverError, type ServerError } from '@/lib/errors';
import { isInstructor } from '@/lib/session-guards';
import { getSessionFromHeaders } from './auth';
import type {
  CancelAppointmentSchema,
  CreateAppointmentSlotSchema,
  ListInstructorAppointmentsSchema,
} from './appointments';

type CancelAppointmentInput = z.infer<typeof CancelAppointmentSchema>;
type CreateAppointmentSlotInput = z.infer<typeof CreateAppointmentSlotSchema>;
type ListInstructorAppointmentsInput = z.infer<typeof ListInstructorAppointmentsSchema>;

type AuthorizedAssignment = { id: number; sectionId: number };

export type AppointmentListRow = {
  id: number;
  assignmentId: number;
  checkpointId: number | null;
  instructorId: string;
  studentId: string | null;
  studentName: string | null;
  studentEmail: string | null;
  startAt: Date;
  endAt: Date;
  status: z.infer<typeof appointmentStatusSchema>;
  createdAt: Date;
  updatedAt: Date;
};

type AppointmentMutationResult = {
  appointment: AppointmentListRow;
};

type AppointmentListResult = {
  appointments: AppointmentListRow[];
  total: number;
};

async function getAuthorizedInstructorAssignment(
  assignmentId: number,
  instructorId: string,
): Promise<AuthorizedAssignment | null> {
  const db = getDb();
  const [assignment] = await db
    .select({ id: assignments.id, sectionId: assignments.sectionId })
    .from(assignments)
    .innerJoin(courseSections, eq(assignments.sectionId, courseSections.id))
    .innerJoin(academicTerms, eq(courseSections.termId, academicTerms.id))
    .innerJoin(
      sectionEnrollments,
      and(
        eq(sectionEnrollments.sectionId, assignments.sectionId),
        eq(sectionEnrollments.userId, instructorId),
        eq(sectionEnrollments.role, 'instructor'),
        eq(sectionEnrollments.isActive, true),
      ),
    )
    .innerJoin(users, eq(users.id, assignments.instructorId))
    .where(
      and(
        eq(assignments.id, assignmentId),
        eq(assignments.instructorId, instructorId),
        eq(assignments.status, 'active'),
        isNull(assignments.deletedAt),
        eq(courseSections.status, 'active'),
        eq(academicTerms.status, 'active'),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  return assignment ?? null;
}

type AppointmentTransaction = Parameters<Parameters<Db['transaction']>[0]>[0];

async function fetchInstructorAppointmentForUpdate(
  tx: AppointmentTransaction,
  appointmentId: number,
  instructorId: string,
) {
  return tx
    .select({
      id: appointments.id,
      assignmentId: appointments.assignmentId,
      checkpointId: appointments.checkpointId,
      instructorId: appointments.instructorId,
      studentId: appointments.studentId,
      startAt: appointments.startAt,
      endAt: appointments.endAt,
      status: appointments.status,
      createdAt: appointments.createdAt,
      updatedAt: appointments.updatedAt,
    })
    .from(appointments)
    .innerJoin(assignments, eq(appointments.assignmentId, assignments.id))
    .innerJoin(courseSections, eq(assignments.sectionId, courseSections.id))
    .innerJoin(academicTerms, eq(courseSections.termId, academicTerms.id))
    .innerJoin(
      sectionEnrollments,
      and(
        eq(sectionEnrollments.sectionId, assignments.sectionId),
        eq(sectionEnrollments.userId, instructorId),
        eq(sectionEnrollments.role, 'instructor'),
        eq(sectionEnrollments.isActive, true),
      ),
    )
    .innerJoin(users, eq(users.id, appointments.instructorId))
    .where(
      and(
        eq(appointments.id, appointmentId),
        eq(appointments.instructorId, instructorId),
        eq(assignments.instructorId, instructorId),
        eq(assignments.status, 'active'),
        isNull(assignments.deletedAt),
        eq(courseSections.status, 'active'),
        eq(academicTerms.status, 'active'),
        isNull(users.deletedAt),
      ),
    )
    .limit(1)
    .for('update', { of: appointments });
}

async function verifyCheckpointForAssignment(
  checkpointId: number,
  assignmentId: number,
): Promise<boolean> {
  const db = getDb();
  const [checkpoint] = await db
    .select({ id: checkpoints.id })
    .from(checkpoints)
    .where(and(eq(checkpoints.id, checkpointId), eq(checkpoints.assignmentId, assignmentId)))
    .limit(1);

  return Boolean(checkpoint);
}

function invalidWindowResponse(): ServerError {
  return serverError(ErrorCode.BAD_REQUEST, 'Appointment window is invalid', {
    handler: 'createAppointmentSlotHandler',
  });
}

export async function createAppointmentSlotHandler(args: {
  data: CreateAppointmentSlotInput;
}): Promise<AppointmentMutationResult | ServerError> {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { assignmentId, checkpointId, startAt, endAt } = args.data;
  const window = validateAppointmentWindow(startAt, endAt);
  if (!window.valid) return invalidWindowResponse();

  try {
    const assignment = await getAuthorizedInstructorAssignment(assignmentId, session.user.id);
    if (!assignment) {
      return serverError(ErrorCode.NOT_FOUND, 'Assignment not found');
    }

    if (checkpointId && !(await verifyCheckpointForAssignment(checkpointId, assignmentId))) {
      return serverError(ErrorCode.NOT_FOUND, 'Checkpoint not found');
    }

    const db = getDb();
    const [appointment] = await db
      .insert(appointments)
      .values({
        assignmentId,
        checkpointId,
        instructorId: session.user.id,
        startAt,
        endAt,
        status: 'available',
      })
      .returning({
        id: appointments.id,
        assignmentId: appointments.assignmentId,
        checkpointId: appointments.checkpointId,
        instructorId: appointments.instructorId,
        studentId: appointments.studentId,
        startAt: appointments.startAt,
        endAt: appointments.endAt,
        status: appointments.status,
        createdAt: appointments.createdAt,
        updatedAt: appointments.updatedAt,
      });

    await safeAuditLog('appointment.created', {
      actorId: session.user.id,
      action: 'appointment.created',
      entityType: 'appointment',
      entityId: String(appointment.id),
      details: { assignmentId, checkpointId: checkpointId ?? null, startAt, endAt },
    });

    return { appointment: { ...appointment, studentName: null, studentEmail: null } };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'createAppointmentSlotHandler',
    });
  }
}

export async function listInstructorAppointmentsHandler(args: {
  data: ListInstructorAppointmentsInput;
}): Promise<AppointmentListResult | ServerError> {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { assignmentId, status, page, limit } = args.data;

  try {
    const assignment = await getAuthorizedInstructorAssignment(assignmentId, session.user.id);
    if (!assignment) {
      return serverError(ErrorCode.NOT_FOUND, 'Assignment not found');
    }

    const db = getDb();
    const conditions = [
      eq(appointments.assignmentId, assignmentId),
      eq(appointments.instructorId, session.user.id),
    ];
    if (status) conditions.push(eq(appointments.status, status));

    const rows = await db
      .select({
        id: appointments.id,
        assignmentId: appointments.assignmentId,
        checkpointId: appointments.checkpointId,
        instructorId: appointments.instructorId,
        studentId: appointments.studentId,
        studentName: users.name,
        studentEmail: users.email,
        startAt: appointments.startAt,
        endAt: appointments.endAt,
        status: appointments.status,
        createdAt: appointments.createdAt,
        updatedAt: appointments.updatedAt,
      })
      .from(appointments)
      .leftJoin(users, eq(appointments.studentId, users.id))
      .where(and(...conditions))
      .orderBy(asc(appointments.startAt), asc(appointments.id))
      .limit(limit)
      .offset((page - 1) * limit);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(appointments)
      .where(and(...conditions));

    return { appointments: rows, total: Number(count) };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'listInstructorAppointmentsHandler',
    });
  }
}

export async function cancelAppointmentHandler(args: {
  data: CancelAppointmentInput;
}): Promise<AppointmentMutationResult | ServerError> {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const db = getDb();
  let auditData:
    | { assignmentId: number; beforeStatus: 'available'; afterStatus: 'cancelled' }
    | undefined;

  try {
    const result = await db.transaction(async (tx) => {
      const [appointment] = await fetchInstructorAppointmentForUpdate(
        tx,
        args.data.appointmentId,
        session.user.id,
      );

      if (!appointment) {
        return serverError(ErrorCode.NOT_FOUND, 'Appointment not found');
      }

      if (appointment.status === 'cancelled') {
        return { appointment: { ...appointment, studentName: null, studentEmail: null } };
      }

      if (appointment.status !== 'available') {
        return serverError(
          ErrorCode.CONFLICT,
          'Appointment cannot be cancelled in its current state',
        );
      }

      const transition = canTransitionAppointment('available', 'cancelled', {
        startAt: appointment.startAt,
        endAt: appointment.endAt,
      });
      if (!transition.valid) {
        return serverError(ErrorCode.BAD_REQUEST, 'Appointment can no longer be cancelled');
      }

      const [cancelledAppointment] = await tx
        .update(appointments)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(and(eq(appointments.id, appointment.id), eq(appointments.status, 'available')))
        .returning({
          id: appointments.id,
          assignmentId: appointments.assignmentId,
          checkpointId: appointments.checkpointId,
          instructorId: appointments.instructorId,
          studentId: appointments.studentId,
          startAt: appointments.startAt,
          endAt: appointments.endAt,
          status: appointments.status,
          createdAt: appointments.createdAt,
          updatedAt: appointments.updatedAt,
        });

      if (!cancelledAppointment) {
        return serverError(ErrorCode.CONFLICT, 'Appointment state changed; please try again');
      }

      auditData = {
        assignmentId: appointment.assignmentId,
        beforeStatus: 'available',
        afterStatus: 'cancelled',
      };

      return {
        appointment: { ...cancelledAppointment, studentName: null, studentEmail: null },
      };
    });

    if (auditData) {
      await safeAuditLog('appointment.cancelled', {
        actorId: session.user.id,
        action: 'appointment.cancelled',
        entityType: 'appointment',
        entityId: String(args.data.appointmentId),
        details: auditData,
      });
    }

    return result;
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'cancelAppointmentHandler',
    });
  }
}
