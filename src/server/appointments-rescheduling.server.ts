// Server-only appointment rescheduling handler.
import { aliasedTable, and, eq, gt, inArray, isNull, lt, ne } from 'drizzle-orm';
import type { z } from 'zod';
import { getDb, type Db } from '@/db/index';
import { academicTerms, courseSections, sectionEnrollments } from '@/db/schema/academic-context';
import { assignments, assignmentStudents } from '@/db/schema/assignments';
import { appointments } from '@/db/schema/appointments';
import { users } from '@/db/schema/users';
import { notifyAppointmentParticipants } from '@/lib/appointment-notifications';
import { validateAppointmentWindow } from '@/lib/appointment-policies';
import { safeAuditLog } from '@/lib/audit';
import { ErrorCode, serverError, type ServerError } from '@/lib/errors';
import { getSessionFromHeaders } from './auth';
import type { RescheduleAppointmentSchema } from './appointments';

type RescheduleAppointmentInput = z.infer<typeof RescheduleAppointmentSchema>;
type AppointmentTransaction = Parameters<Parameters<Db['transaction']>[0]>[0];

const instructorUsers = aliasedTable(users, 'appointment_reschedule_instructor');
const studentUsers = aliasedTable(users, 'appointment_reschedule_student');

type RescheduleRow = {
  id: number;
  assignmentId: number;
  checkpointId: number | null;
  instructorId: string;
  studentId: string | null;
  startAt: Date;
  endAt: Date;
  status: 'available' | 'booked' | 'cancelled' | 'completed' | 'no_show';
  createdAt: Date;
  updatedAt: Date;
};

function appointmentSelection() {
  return {
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
  };
}

async function fetchStudentAppointmentsForUpdate(
  tx: AppointmentTransaction,
  appointmentIds: [number, number],
  studentId: string,
) {
  return tx
    .select(appointmentSelection())
    .from(appointments)
    .innerJoin(assignments, eq(appointments.assignmentId, assignments.id))
    .innerJoin(courseSections, eq(assignments.sectionId, courseSections.id))
    .innerJoin(academicTerms, eq(courseSections.termId, academicTerms.id))
    .innerJoin(
      sectionEnrollments,
      and(
        eq(sectionEnrollments.sectionId, assignments.sectionId),
        eq(sectionEnrollments.userId, appointments.instructorId),
        eq(sectionEnrollments.role, 'instructor'),
        eq(sectionEnrollments.isActive, true),
      ),
    )
    .innerJoin(instructorUsers, eq(instructorUsers.id, appointments.instructorId))
    .innerJoin(
      assignmentStudents,
      and(
        eq(assignmentStudents.assignmentId, assignments.id),
        eq(assignmentStudents.studentId, studentId),
      ),
    )
    .innerJoin(
      studentUsers,
      and(
        eq(studentUsers.id, studentId),
        eq(studentUsers.role, 'student'),
        isNull(studentUsers.deletedAt),
      ),
    )
    .where(
      and(
        inArray(appointments.id, appointmentIds),
        eq(assignments.status, 'active'),
        isNull(assignments.deletedAt),
        eq(courseSections.status, 'active'),
        eq(academicTerms.status, 'active'),
        isNull(instructorUsers.deletedAt),
      ),
    )
    .for('update', { of: appointments });
}

async function fetchInstructorAppointmentsForUpdate(
  tx: AppointmentTransaction,
  appointmentIds: [number, number],
  instructorId: string,
) {
  return tx
    .select(appointmentSelection())
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
    .innerJoin(instructorUsers, eq(instructorUsers.id, appointments.instructorId))
    .where(
      and(
        inArray(appointments.id, appointmentIds),
        eq(appointments.instructorId, instructorId),
        eq(assignments.instructorId, instructorId),
        eq(assignments.status, 'active'),
        isNull(assignments.deletedAt),
        eq(courseSections.status, 'active'),
        eq(academicTerms.status, 'active'),
        isNull(instructorUsers.deletedAt),
      ),
    )
    .for('update', { of: appointments });
}

async function lockParticipants(
  tx: AppointmentTransaction,
  instructorId: string,
  studentId: string,
  assignmentId: number,
) {
  const [instructor] = await tx
    .select({ id: instructorUsers.id })
    .from(instructorUsers)
    .where(
      and(
        eq(instructorUsers.id, instructorId),
        eq(instructorUsers.role, 'instructor'),
        isNull(instructorUsers.deletedAt),
      ),
    )
    .for('update', { of: instructorUsers });

  const [student] = await tx
    .select({ id: studentUsers.id })
    .from(studentUsers)
    .where(
      and(
        eq(studentUsers.id, studentId),
        eq(studentUsers.role, 'student'),
        isNull(studentUsers.deletedAt),
      ),
    )
    .for('update', { of: studentUsers });

  const [enrollment] = await tx
    .select({ id: assignmentStudents.id })
    .from(assignmentStudents)
    .where(
      and(
        eq(assignmentStudents.assignmentId, assignmentId),
        eq(assignmentStudents.studentId, studentId),
      ),
    )
    .for('update', { of: assignmentStudents });

  return Boolean(instructor && student && enrollment);
}

export async function rescheduleAppointmentHandler(args: {
  data: RescheduleAppointmentInput;
}): Promise<{ appointment: RescheduleRow } | ServerError> {
  const session = await getSessionFromHeaders();
  const role = session?.user.role;
  if (!session || (role !== 'instructor' && role !== 'student')) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const db = getDb();
  let auditData:
    | {
        assignmentId: number;
        replacementAppointmentId: number;
        beforeStartAt: Date;
        beforeEndAt: Date;
        afterStartAt: Date;
        afterEndAt: Date;
      }
    | undefined;
  let notificationData:
    | {
        appointmentId: number;
        assignmentId: number;
        checkpointId: number | null;
        instructorId: string;
        studentId: string;
        startAt: Date;
        endAt: Date;
      }
    | undefined;

  try {
    const result = await db.transaction(async (tx) => {
      const appointmentIds: [number, number] = [
        args.data.appointmentId,
        args.data.replacementAppointmentId,
      ];
      const rows =
        role === 'instructor'
          ? await fetchInstructorAppointmentsForUpdate(tx, appointmentIds, session.user.id)
          : await fetchStudentAppointmentsForUpdate(tx, appointmentIds, session.user.id);
      const original = rows.find((row) => row.id === args.data.appointmentId) as
        | RescheduleRow
        | undefined;
      const replacement = rows.find((row) => row.id === args.data.replacementAppointmentId) as
        | RescheduleRow
        | undefined;

      if (!original || !replacement) {
        return serverError(ErrorCode.NOT_FOUND, 'Appointment not found');
      }

      if (original.status !== 'booked' || original.studentId === null) {
        return serverError(
          ErrorCode.CONFLICT,
          'Appointment cannot be rescheduled in its current state',
        );
      }

      if (
        replacement.status !== 'available' ||
        replacement.studentId !== null ||
        replacement.assignmentId !== original.assignmentId ||
        replacement.instructorId !== original.instructorId
      ) {
        return serverError(ErrorCode.CONFLICT, 'Replacement appointment is unavailable');
      }

      const now = new Date();
      if (original.startAt.getTime() <= now.getTime()) {
        return serverError(ErrorCode.BAD_REQUEST, 'Appointment can no longer be rescheduled');
      }

      const replacementWindow = validateAppointmentWindow(
        replacement.startAt,
        replacement.endAt,
        now,
      );
      if (!replacementWindow.valid) {
        return serverError(ErrorCode.BAD_REQUEST, 'Appointment can no longer be rescheduled');
      }

      if (
        !(await lockParticipants(
          tx,
          original.instructorId,
          original.studentId,
          original.assignmentId,
        ))
      ) {
        return serverError(ErrorCode.NOT_FOUND, 'Appointment not found');
      }

      const [instructorConflict] = await tx
        .select({ id: appointments.id })
        .from(appointments)
        .where(
          and(
            eq(appointments.instructorId, original.instructorId),
            eq(appointments.status, 'booked'),
            ne(appointments.id, original.id),
            lt(appointments.startAt, replacement.endAt),
            gt(appointments.endAt, replacement.startAt),
          ),
        )
        .limit(1);
      if (instructorConflict) {
        return serverError(ErrorCode.CONFLICT, 'Appointment conflicts with an existing booking');
      }

      const [studentConflict] = await tx
        .select({ id: appointments.id })
        .from(appointments)
        .where(
          and(
            eq(appointments.studentId, original.studentId),
            eq(appointments.status, 'booked'),
            ne(appointments.id, original.id),
            lt(appointments.startAt, replacement.endAt),
            gt(appointments.endAt, replacement.startAt),
          ),
        )
        .limit(1);
      if (studentConflict) {
        return serverError(ErrorCode.CONFLICT, 'Appointment conflicts with an existing booking');
      }

      const [rescheduledAppointment] = await tx
        .update(appointments)
        .set({
          startAt: replacement.startAt,
          endAt: replacement.endAt,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(appointments.id, original.id),
            eq(appointments.status, 'booked'),
            eq(appointments.studentId, original.studentId),
          ),
        )
        .returning(appointmentSelection());

      if (!rescheduledAppointment) {
        return serverError(ErrorCode.CONFLICT, 'Appointment state changed; please try again');
      }

      const [cancelledReplacement] = await tx
        .update(appointments)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(
          and(
            eq(appointments.id, replacement.id),
            eq(appointments.status, 'available'),
            isNull(appointments.studentId),
          ),
        )
        .returning({ id: appointments.id });
      if (!cancelledReplacement) {
        return serverError(ErrorCode.CONFLICT, 'Replacement appointment is no longer available');
      }

      auditData = {
        assignmentId: original.assignmentId,
        replacementAppointmentId: replacement.id,
        beforeStartAt: original.startAt,
        beforeEndAt: original.endAt,
        afterStartAt: replacement.startAt,
        afterEndAt: replacement.endAt,
      };
      notificationData = {
        appointmentId: rescheduledAppointment.id,
        assignmentId: rescheduledAppointment.assignmentId,
        checkpointId: rescheduledAppointment.checkpointId,
        instructorId: rescheduledAppointment.instructorId,
        studentId: original.studentId,
        startAt: rescheduledAppointment.startAt,
        endAt: rescheduledAppointment.endAt,
      };

      return { appointment: rescheduledAppointment };
    });

    if (auditData) {
      await safeAuditLog('appointment.rescheduled', {
        actorId: session.user.id,
        action: 'appointment.rescheduled',
        entityType: 'appointment',
        entityId: String(args.data.appointmentId),
        details: auditData,
      });
    }
    if (notificationData) {
      void notifyAppointmentParticipants({
        event: 'appointment_rescheduled',
        appointmentId: notificationData.appointmentId,
        assignmentId: notificationData.assignmentId,
        checkpointId: notificationData.checkpointId,
        participantIds: [notificationData.studentId, notificationData.instructorId],
        startAt: notificationData.startAt,
        endAt: notificationData.endAt,
      });
    }

    return result;
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'rescheduleAppointmentHandler',
    });
  }
}
