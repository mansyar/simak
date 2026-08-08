// Server-only appointment outcome handlers. This module must never be imported by client code.
import { aliasedTable, and, eq, isNull } from 'drizzle-orm';
import type { z } from 'zod';
import { getDb, type Db } from '@/db/index';
import { academicTerms, courseSections, sectionEnrollments } from '@/db/schema/academic-context';
import { assignments } from '@/db/schema/assignments';
import { appointments } from '@/db/schema/appointments';
import { users } from '@/db/schema/users';
import { notifyAppointmentParticipants } from '@/lib/appointment-notifications';
import { canTransitionAppointment } from '@/lib/appointment-policies';
import { safeAuditLog } from '@/lib/audit';
import { ErrorCode, serverError, type ServerError } from '@/lib/errors';
import { getSessionFromHeaders } from './auth';
import type { CompleteAppointmentSchema } from './appointments';

type AppointmentOutcomeInput = z.infer<typeof CompleteAppointmentSchema>;
type AppointmentTransaction = Parameters<Parameters<Db['transaction']>[0]>[0];
type AppointmentOutcome = 'completed' | 'no_show';

type OutcomeAppointment = {
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

const outcomeInstructor = aliasedTable(users, 'appointment_outcome_instructor');
const outcomeInstructorEnrollment = aliasedTable(
  sectionEnrollments,
  'appointment_outcome_instructor_enrollment',
);

async function fetchInstructorAppointmentForOutcome(
  tx: AppointmentTransaction,
  appointmentId: number,
  instructorId: string,
): Promise<OutcomeAppointment | null> {
  const [appointment] = await tx
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
      outcomeInstructorEnrollment,
      and(
        eq(outcomeInstructorEnrollment.sectionId, assignments.sectionId),
        eq(outcomeInstructorEnrollment.userId, instructorId),
        eq(outcomeInstructorEnrollment.role, 'instructor'),
        eq(outcomeInstructorEnrollment.isActive, true),
      ),
    )
    .innerJoin(
      outcomeInstructor,
      and(
        eq(outcomeInstructor.id, instructorId),
        eq(outcomeInstructor.role, 'instructor'),
        isNull(outcomeInstructor.deletedAt),
      ),
    )
    .where(
      and(
        eq(appointments.id, appointmentId),
        eq(assignments.instructorId, instructorId),
        eq(assignments.status, 'active'),
        isNull(assignments.deletedAt),
        eq(courseSections.status, 'active'),
        eq(academicTerms.status, 'active'),
      ),
    )
    .limit(1)
    .for('update', { of: appointments });

  return appointment ?? null;
}

async function transitionAppointmentOutcome(
  args: { data: AppointmentOutcomeInput },
  nextStatus: AppointmentOutcome,
): Promise<{ appointment: OutcomeAppointment } | ServerError> {
  const session = await getSessionFromHeaders();
  if (!session || session.user.role !== 'instructor') {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  let auditData:
    | {
        actorId: string;
        assignmentId: number;
        beforeStatus: 'booked';
        afterStatus: AppointmentOutcome;
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
    const db = getDb();
    const result = await db.transaction(async (tx) => {
      const appointment = await fetchInstructorAppointmentForOutcome(
        tx,
        args.data.appointmentId,
        session.user.id,
      );

      if (!appointment) {
        return serverError(ErrorCode.NOT_FOUND, 'Appointment not found');
      }

      if (!appointment.studentId) {
        return serverError(
          ErrorCode.CONFLICT,
          `Appointment cannot be ${nextStatus === 'completed' ? 'completed' : 'marked as no-show'} in its current state`,
        );
      }

      const transition = canTransitionAppointment(appointment.status, nextStatus, {
        startAt: appointment.startAt,
        endAt: appointment.endAt,
      });
      if (!transition.valid) {
        const action = nextStatus === 'completed' ? 'completed' : 'marked as no-show';
        return serverError(
          ErrorCode.CONFLICT,
          `Appointment cannot be ${action} in its current state`,
        );
      }

      const [updatedAppointment] = await tx
        .update(appointments)
        .set({ status: nextStatus, updatedAt: new Date() })
        .where(and(eq(appointments.id, appointment.id), eq(appointments.status, 'booked')))
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

      if (!updatedAppointment) {
        return serverError(ErrorCode.CONFLICT, 'Appointment state changed; please try again');
      }

      auditData = {
        actorId: session.user.id,
        assignmentId: updatedAppointment.assignmentId,
        beforeStatus: 'booked',
        afterStatus: nextStatus,
      };
      notificationData = {
        appointmentId: updatedAppointment.id,
        assignmentId: updatedAppointment.assignmentId,
        checkpointId: updatedAppointment.checkpointId,
        instructorId: updatedAppointment.instructorId,
        studentId: updatedAppointment.studentId ?? appointment.studentId,
        startAt: updatedAppointment.startAt,
        endAt: updatedAppointment.endAt,
      };

      return { appointment: updatedAppointment };
    });

    if (auditData) {
      await safeAuditLog(`appointment.${nextStatus}`, {
        actorId: auditData.actorId,
        action: `appointment.${nextStatus}`,
        entityType: 'appointment',
        entityId: String(args.data.appointmentId),
        details: auditData,
      });
    }
    if (notificationData) {
      void notifyAppointmentParticipants({
        event: nextStatus === 'completed' ? 'appointment_completed' : 'appointment_no_show',
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
      handler: 'transitionAppointmentOutcome',
    });
  }
}

export async function completeAppointmentHandler(args: {
  data: AppointmentOutcomeInput;
}): Promise<{ appointment: OutcomeAppointment } | ServerError> {
  return transitionAppointmentOutcome(args, 'completed');
}

export async function markAppointmentNoShowHandler(args: {
  data: AppointmentOutcomeInput;
}): Promise<{ appointment: OutcomeAppointment } | ServerError> {
  return transitionAppointmentOutcome(args, 'no_show');
}
