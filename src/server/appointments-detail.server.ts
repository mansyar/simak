// Server-only appointment detail handler. This module must never be imported by client code.
import { aliasedTable, and, eq, isNull } from 'drizzle-orm';
import type { z } from 'zod';
import { getDb } from '@/db/index';
import { academicTerms, courseSections, sectionEnrollments } from '@/db/schema/academic-context';
import { assignments, assignmentStudents, checkpoints } from '@/db/schema/assignments';
import { appointments } from '@/db/schema/appointments';
import { users } from '@/db/schema/users';
import { ErrorCode, serverError, type ServerError } from '@/lib/errors';
import { getSessionFromHeaders } from './auth';
import type { AppointmentIdSchema, AppointmentListItem } from './appointments';

type AppointmentIdInput = z.infer<typeof AppointmentIdSchema>;

const detailInstructor = aliasedTable(users, 'appointment_detail_instructor');
const detailStudent = aliasedTable(users, 'appointment_detail_student');
const detailEnrollment = aliasedTable(sectionEnrollments, 'appointment_detail_enrollment');

export async function getAppointmentDetailHandler(args: {
  data: AppointmentIdInput;
}): Promise<{ appointment: AppointmentListItem } | ServerError> {
  const session = await getSessionFromHeaders();
  if (!session || !['student', 'instructor'].includes(session.user.role)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  try {
    const db = getDb();
    const isStudent = session.user.role === 'student';
    const [appointment] = isStudent
      ? await db
          .select({
            id: appointments.id,
            assignmentId: appointments.assignmentId,
            checkpointId: checkpoints.id,
            checkpointName: checkpoints.name,
            instructorId: appointments.instructorId,
            studentId: appointments.studentId,
            studentName: detailStudent.name,
            studentEmail: detailStudent.email,
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
            assignmentStudents,
            and(
              eq(assignmentStudents.assignmentId, assignments.id),
              eq(assignmentStudents.studentId, session.user.id),
            ),
          )
          .innerJoin(
            detailEnrollment,
            and(
              eq(detailEnrollment.sectionId, assignments.sectionId),
              eq(detailEnrollment.userId, appointments.instructorId),
              eq(detailEnrollment.role, 'instructor'),
              eq(detailEnrollment.isActive, true),
            ),
          )
          .innerJoin(
            detailInstructor,
            and(
              eq(detailInstructor.id, appointments.instructorId),
              eq(detailInstructor.role, 'instructor'),
              isNull(detailInstructor.deletedAt),
            ),
          )
          .innerJoin(
            detailStudent,
            and(
              eq(detailStudent.id, session.user.id),
              eq(detailStudent.role, 'student'),
              isNull(detailStudent.deletedAt),
            ),
          )
          .leftJoin(
            checkpoints,
            and(
              eq(checkpoints.id, appointments.checkpointId),
              eq(checkpoints.assignmentId, assignments.id),
              eq(checkpoints.studentId, session.user.id),
            ),
          )
          .where(
            and(
              eq(appointments.id, args.data.appointmentId),
              eq(appointments.studentId, session.user.id),
              eq(assignments.status, 'active'),
              isNull(assignments.deletedAt),
              eq(courseSections.status, 'active'),
              eq(academicTerms.status, 'active'),
            ),
          )
          .limit(1)
      : await db
          .select({
            id: appointments.id,
            assignmentId: appointments.assignmentId,
            checkpointId: checkpoints.id,
            checkpointName: checkpoints.name,
            instructorId: appointments.instructorId,
            studentId: appointments.studentId,
            studentName: detailStudent.name,
            studentEmail: detailStudent.email,
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
            detailEnrollment,
            and(
              eq(detailEnrollment.sectionId, assignments.sectionId),
              eq(detailEnrollment.userId, session.user.id),
              eq(detailEnrollment.role, 'instructor'),
              eq(detailEnrollment.isActive, true),
            ),
          )
          .innerJoin(
            detailInstructor,
            and(
              eq(detailInstructor.id, session.user.id),
              eq(detailInstructor.role, 'instructor'),
              isNull(detailInstructor.deletedAt),
            ),
          )
          .leftJoin(
            detailStudent,
            and(
              eq(detailStudent.id, appointments.studentId),
              eq(detailStudent.role, 'student'),
              isNull(detailStudent.deletedAt),
            ),
          )
          .leftJoin(
            checkpoints,
            and(
              eq(checkpoints.id, appointments.checkpointId),
              eq(checkpoints.assignmentId, assignments.id),
            ),
          )
          .where(
            and(
              eq(appointments.id, args.data.appointmentId),
              eq(appointments.instructorId, session.user.id),
              eq(assignments.instructorId, session.user.id),
              eq(assignments.status, 'active'),
              isNull(assignments.deletedAt),
              eq(courseSections.status, 'active'),
              eq(academicTerms.status, 'active'),
            ),
          )
          .limit(1);

    if (!appointment) return serverError(ErrorCode.NOT_FOUND, 'Appointment not found');
    return { appointment };
  } catch (error) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: error instanceof Error ? error.message : String(error),
      handler: 'getAppointmentDetailHandler',
    });
  }
}
