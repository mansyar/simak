// Server-only lifecycle handlers. This module must never be imported by client code.
import { aliasedTable, and, eq, gt, isNull, lt, ne } from 'drizzle-orm';
import type { z } from 'zod';
import { getDb, type Db } from '@/db/index';
import { appointments } from '@/db/schema/appointments';
import { assignments, assignmentStudents, checkpoints } from '@/db/schema/assignments';
import { academicTerms, courseSections, sectionEnrollments } from '@/db/schema/academic-context';
import { users } from '@/db/schema/users';
import { notifyAppointmentParticipants } from '@/lib/appointment-notifications';
import { validateAppointmentWindow } from '@/lib/appointment-policies';
import { safeAuditLog } from '@/lib/audit';
import { ErrorCode, serverError, type ServerError } from '@/lib/errors';
import { isStudent } from '@/lib/session-guards';
import { getSessionFromHeaders } from './auth';
import type { BookAppointmentSchema } from './appointments';

type BookAppointmentInput = z.infer<typeof BookAppointmentSchema>;
type AppointmentTransaction = Parameters<Parameters<Db['transaction']>[0]>[0];

type BookingAppointment = {
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

const bookingInstructor = aliasedTable(users, 'appointment_booking_instructor');
const bookingStudent = aliasedTable(users, 'appointment_booking_student');
const bookingInstructorEnrollment = aliasedTable(
  sectionEnrollments,
  'appointment_booking_instructor_enrollment',
);

async function fetchStudentAppointmentForUpdate(
  tx: AppointmentTransaction,
  appointmentId: number,
  studentId: string,
): Promise<BookingAppointment | null> {
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
      bookingInstructorEnrollment,
      and(
        eq(bookingInstructorEnrollment.sectionId, assignments.sectionId),
        eq(bookingInstructorEnrollment.userId, appointments.instructorId),
        eq(bookingInstructorEnrollment.role, 'instructor'),
        eq(bookingInstructorEnrollment.isActive, true),
      ),
    )
    .innerJoin(
      bookingInstructor,
      and(
        eq(bookingInstructor.id, appointments.instructorId),
        eq(bookingInstructor.role, 'instructor'),
        isNull(bookingInstructor.deletedAt),
      ),
    )
    .innerJoin(
      assignmentStudents,
      and(
        eq(assignmentStudents.assignmentId, assignments.id),
        eq(assignmentStudents.studentId, studentId),
      ),
    )
    .innerJoin(
      bookingStudent,
      and(
        eq(bookingStudent.id, studentId),
        eq(bookingStudent.role, 'student'),
        isNull(bookingStudent.deletedAt),
      ),
    )
    .where(
      and(
        eq(appointments.id, appointmentId),
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

async function lockBookingParticipants(
  tx: AppointmentTransaction,
  appointment: BookingAppointment,
  studentId: string,
): Promise<boolean> {
  const [instructor] = await tx
    .select({ id: bookingInstructor.id })
    .from(bookingInstructor)
    .where(
      and(
        eq(bookingInstructor.id, appointment.instructorId),
        eq(bookingInstructor.role, 'instructor'),
        isNull(bookingInstructor.deletedAt),
      ),
    )
    .limit(1)
    .for('update', { of: bookingInstructor });

  if (!instructor) return false;

  const [student] = await tx
    .select({ id: bookingStudent.id })
    .from(bookingStudent)
    .where(
      and(
        eq(bookingStudent.id, studentId),
        eq(bookingStudent.role, 'student'),
        isNull(bookingStudent.deletedAt),
      ),
    )
    .limit(1)
    .for('update', { of: bookingStudent });

  if (!student) return false;

  const [enrollment] = await tx
    .select({ id: assignmentStudents.id })
    .from(assignmentStudents)
    .where(
      and(
        eq(assignmentStudents.assignmentId, appointment.assignmentId),
        eq(assignmentStudents.studentId, studentId),
      ),
    )
    .limit(1)
    .for('update', { of: assignmentStudents });

  return Boolean(enrollment);
}

async function hasAppointmentConflict(
  tx: AppointmentTransaction,
  participantColumn: typeof appointments.instructorId | typeof appointments.studentId,
  participantId: string,
  appointment: BookingAppointment,
): Promise<boolean> {
  const [conflict] = await tx
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(participantColumn, participantId),
        eq(appointments.status, 'booked'),
        ne(appointments.id, appointment.id),
        lt(appointments.startAt, appointment.endAt),
        gt(appointments.endAt, appointment.startAt),
      ),
    )
    .limit(1);

  return Boolean(conflict);
}

export async function bookAppointmentHandler(args: {
  data: BookAppointmentInput;
}): Promise<{ appointment: BookingAppointment } | ServerError> {
  const session = await getSessionFromHeaders();
  if (!isStudent(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const db = getDb();
  let auditData:
    | {
        assignmentId: number;
        beforeStatus: 'available';
        afterStatus: 'booked';
        checkpointId: number | null;
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
      const appointment = await fetchStudentAppointmentForUpdate(
        tx,
        args.data.appointmentId,
        session.user.id,
      );

      if (!appointment) {
        return serverError(ErrorCode.NOT_FOUND, 'Appointment not found');
      }

      if (appointment.status !== 'available' || appointment.studentId !== null) {
        return serverError(ErrorCode.CONFLICT, 'Appointment is no longer available');
      }

      const window = validateAppointmentWindow(appointment.startAt, appointment.endAt);
      if (!window.valid) {
        return serverError(ErrorCode.BAD_REQUEST, 'Appointment can no longer be booked');
      }

      if (!(await lockBookingParticipants(tx, appointment, session.user.id))) {
        return serverError(ErrorCode.NOT_FOUND, 'Appointment not found');
      }

      const checkpointId = args.data.checkpointId ?? appointment.checkpointId;
      if (checkpointId !== null && checkpointId !== undefined) {
        const [checkpoint] = await tx
          .select({ id: checkpoints.id })
          .from(checkpoints)
          .where(
            and(
              eq(checkpoints.id, checkpointId),
              eq(checkpoints.assignmentId, appointment.assignmentId),
              eq(checkpoints.studentId, session.user.id),
            ),
          )
          .limit(1);

        if (!checkpoint) {
          return serverError(ErrorCode.NOT_FOUND, 'Checkpoint not found');
        }
      }

      if (
        (await hasAppointmentConflict(
          tx,
          appointments.instructorId,
          appointment.instructorId,
          appointment,
        )) ||
        (await hasAppointmentConflict(tx, appointments.studentId, session.user.id, appointment))
      ) {
        return serverError(ErrorCode.CONFLICT, 'Appointment conflicts with an existing booking');
      }

      const [bookedAppointment] = await tx
        .update(appointments)
        .set({
          studentId: session.user.id,
          checkpointId: checkpointId ?? null,
          status: 'booked',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(appointments.id, appointment.id),
            eq(appointments.status, 'available'),
            isNull(appointments.studentId),
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

      if (!bookedAppointment) {
        return serverError(ErrorCode.CONFLICT, 'Appointment is no longer available');
      }

      auditData = {
        assignmentId: appointment.assignmentId,
        beforeStatus: 'available',
        afterStatus: 'booked',
        checkpointId: checkpointId ?? null,
      };
      notificationData = {
        appointmentId: bookedAppointment.id,
        assignmentId: bookedAppointment.assignmentId,
        checkpointId: bookedAppointment.checkpointId,
        instructorId: bookedAppointment.instructorId,
        studentId: bookedAppointment.studentId ?? session.user.id,
        startAt: bookedAppointment.startAt,
        endAt: bookedAppointment.endAt,
      };

      return { appointment: bookedAppointment };
    });

    if (auditData) {
      await safeAuditLog('appointment.booked', {
        actorId: session.user.id,
        action: 'appointment.booked',
        entityType: 'appointment',
        entityId: String(args.data.appointmentId),
        details: auditData,
      });
    }
    if (notificationData) {
      void notifyAppointmentParticipants({
        event: 'appointment_booked',
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
      handler: 'bookAppointmentHandler',
    });
  }
}

async function appointmentLifecycleHandlerNotImplemented(_context: unknown): Promise<never> {
  throw new Error('Appointment lifecycle handler is not implemented');
}

export const listAvailableAppointmentsHandler = appointmentLifecycleHandlerNotImplemented;
export const listStudentAppointmentsHandler = appointmentLifecycleHandlerNotImplemented;
export const rescheduleAppointmentHandler = appointmentLifecycleHandlerNotImplemented;
export const getAppointmentDetailHandler = appointmentLifecycleHandlerNotImplemented;
