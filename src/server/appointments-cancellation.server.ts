// Server-only student appointment cancellation handler.
import { and, eq, isNull, aliasedTable } from 'drizzle-orm';
import type { z } from 'zod';
import { getDb, type Db } from '@/db/index';
import { academicTerms, courseSections, sectionEnrollments } from '@/db/schema/academic-context';
import { assignments, assignmentStudents } from '@/db/schema/assignments';
import { appointments } from '@/db/schema/appointments';
import { notifyAppointmentParticipants } from '@/lib/appointment-notifications';
import { canTransitionAppointment } from '@/lib/appointment-policies';
import { safeAuditLog } from '@/lib/audit';
import { ErrorCode, serverError, type ServerError } from '@/lib/errors';
import { isStudent } from '@/lib/session-guards';
import { getSessionFromHeaders } from './auth';
import type { CancelAppointmentSchema } from './appointments';
import type { AppointmentListRow } from './appointments.server';
import { users } from '@/db/schema/users';

type CancelAppointmentInput = z.infer<typeof CancelAppointmentSchema>;
type AppointmentTransaction = Parameters<Parameters<Db['transaction']>[0]>[0];

const instructorUsers = aliasedTable(users, 'appointment_cancel_instructor');
const studentUsers = aliasedTable(users, 'appointment_cancel_student');

async function fetchStudentAppointmentForUpdate(
  tx: AppointmentTransaction,
  appointmentId: number,
  studentId: string,
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
        eq(appointments.id, appointmentId),
        eq(appointments.studentId, studentId),
        eq(assignments.status, 'active'),
        isNull(assignments.deletedAt),
        eq(courseSections.status, 'active'),
        eq(academicTerms.status, 'active'),
        isNull(instructorUsers.deletedAt),
      ),
    )
    .limit(1)
    .for('update', { of: appointments });
}

export async function cancelStudentAppointmentHandler(args: {
  data: CancelAppointmentInput;
}): Promise<{ appointment: AppointmentListRow } | ServerError> {
  const session = await getSessionFromHeaders();
  if (!isStudent(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  let auditData:
    | { assignmentId: number; beforeStatus: 'booked'; afterStatus: 'cancelled' }
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
    const db = getDb();
    const result = await db.transaction(async (tx) => {
      const [appointment] = await fetchStudentAppointmentForUpdate(
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

      if (appointment.status !== 'booked') {
        return serverError(
          ErrorCode.CONFLICT,
          'Appointment cannot be cancelled in its current state',
        );
      }

      const transition = canTransitionAppointment('booked', 'cancelled', {
        startAt: appointment.startAt,
        endAt: appointment.endAt,
      });
      if (!transition.valid) {
        return serverError(ErrorCode.BAD_REQUEST, 'Appointment can no longer be cancelled');
      }

      const [cancelledAppointment] = await tx
        .update(appointments)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(
          and(
            eq(appointments.id, appointment.id),
            eq(appointments.status, 'booked'),
            eq(appointments.studentId, session.user.id),
          ),
        )
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
        beforeStatus: 'booked',
        afterStatus: 'cancelled',
      };
      notificationData = {
        appointmentId: cancelledAppointment.id,
        assignmentId: cancelledAppointment.assignmentId,
        checkpointId: cancelledAppointment.checkpointId,
        instructorId: cancelledAppointment.instructorId,
        studentId: cancelledAppointment.studentId ?? session.user.id,
        startAt: cancelledAppointment.startAt,
        endAt: cancelledAppointment.endAt,
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
    if (notificationData) {
      void notifyAppointmentParticipants({
        event: 'appointment_cancelled',
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
      handler: 'cancelStudentAppointmentHandler',
    });
  }
}
