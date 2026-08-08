// Server-only appointment list handlers. This module must never be imported by client code.
import { aliasedTable, and, asc, eq, gt, isNull, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { getDb } from '@/db/index';
import { appointments } from '@/db/schema/appointments';
import { academicTerms, courseSections, sectionEnrollments } from '@/db/schema/academic-context';
import { assignments, assignmentStudents, checkpoints } from '@/db/schema/assignments';
import { ErrorCode, serverError, type ServerError } from '@/lib/errors';
import { isStudent } from '@/lib/session-guards';
import { getSessionFromHeaders } from './auth';
import type {
  AppointmentListItem,
  AppointmentListResponse,
  ListAvailableAppointmentsSchema,
  ListStudentAppointmentsSchema,
} from './appointments';
import { users } from '@/db/schema/users';

type ListAvailableAppointmentsInput = z.infer<typeof ListAvailableAppointmentsSchema>;
type ListStudentAppointmentsInput = z.infer<typeof ListStudentAppointmentsSchema>;

const availableInstructor = aliasedTable(users, 'appointment_list_available_instructor');
const availableStudent = aliasedTable(users, 'appointment_list_available_student');
const availableInstructorEnrollment = aliasedTable(
  sectionEnrollments,
  'appointment_list_available_instructor_enrollment',
);
const studentListInstructor = aliasedTable(users, 'appointment_list_student_instructor');
const studentListStudent = aliasedTable(users, 'appointment_list_student_student');
const studentListInstructorEnrollment = aliasedTable(
  sectionEnrollments,
  'appointment_list_student_instructor_enrollment',
);

function appointmentProjection() {
  return {
    id: appointments.id,
    assignmentId: appointments.assignmentId,
    checkpointId: checkpoints.id,
    checkpointName: checkpoints.name,
    instructorId: appointments.instructorId,
    studentId: appointments.studentId,
    startAt: appointments.startAt,
    endAt: appointments.endAt,
    status: appointments.status,
  };
}

function availableConditions(
  input: ListAvailableAppointmentsInput,
  studentId: string,
): ReturnType<typeof and> {
  const conditions = [
    eq(appointments.assignmentId, input.assignmentId),
    eq(appointments.status, 'available' as const),
    isNull(appointments.studentId),
    gt(appointments.startAt, new Date()),
    eq(assignments.status, 'active' as const),
    isNull(assignments.deletedAt),
    eq(courseSections.status, 'active' as const),
    eq(academicTerms.status, 'active' as const),
    eq(assignmentStudents.studentId, studentId),
    eq(availableStudent.id, studentId),
    eq(availableStudent.role, 'student' as const),
    isNull(availableStudent.deletedAt),
    eq(availableInstructorEnrollment.role, 'instructor' as const),
    eq(availableInstructorEnrollment.isActive, true),
    eq(availableInstructor.role, 'instructor' as const),
    isNull(availableInstructor.deletedAt),
  ];

  if (input.checkpointId !== undefined) {
    conditions.push(eq(appointments.checkpointId, input.checkpointId));
  }

  return and(...conditions);
}

function studentConditions(
  input: ListStudentAppointmentsInput,
  studentId: string,
): ReturnType<typeof and> {
  const conditions = [
    eq(appointments.studentId, studentId),
    eq(assignments.status, 'active' as const),
    isNull(assignments.deletedAt),
    eq(courseSections.status, 'active' as const),
    eq(academicTerms.status, 'active' as const),
    eq(assignmentStudents.studentId, studentId),
    eq(studentListStudent.id, studentId),
    eq(studentListStudent.role, 'student' as const),
    isNull(studentListStudent.deletedAt),
    eq(studentListInstructorEnrollment.role, 'instructor' as const),
    eq(studentListInstructorEnrollment.isActive, true),
    eq(studentListInstructor.role, 'instructor' as const),
    isNull(studentListInstructor.deletedAt),
  ];

  if (input.assignmentId !== undefined) {
    conditions.push(eq(appointments.assignmentId, input.assignmentId));
  }

  return and(...conditions);
}

function listResponse(
  rows: AppointmentListItem[],
  total: number,
  page: number,
  limit: number,
): AppointmentListResponse {
  return { appointments: rows, total, page, limit };
}

export async function listAvailableAppointmentsHandler(args: {
  data: ListAvailableAppointmentsInput;
}): Promise<AppointmentListResponse | ServerError> {
  const session = await getSessionFromHeaders();
  if (!isStudent(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  try {
    const db = getDb();
    const conditions = availableConditions(args.data, session.user.id);
    const offset = (args.data.page - 1) * args.data.limit;
    const rows = await db
      .select(appointmentProjection())
      .from(appointments)
      .innerJoin(assignments, eq(appointments.assignmentId, assignments.id))
      .innerJoin(courseSections, eq(assignments.sectionId, courseSections.id))
      .innerJoin(academicTerms, eq(courseSections.termId, academicTerms.id))
      .innerJoin(assignmentStudents, eq(assignmentStudents.assignmentId, assignments.id))
      .innerJoin(
        availableInstructorEnrollment,
        and(
          eq(availableInstructorEnrollment.sectionId, assignments.sectionId),
          eq(availableInstructorEnrollment.userId, appointments.instructorId),
        ),
      )
      .innerJoin(availableInstructor, eq(availableInstructor.id, appointments.instructorId))
      .innerJoin(availableStudent, eq(availableStudent.id, session.user.id))
      .leftJoin(
        checkpoints,
        and(
          eq(checkpoints.id, appointments.checkpointId),
          eq(checkpoints.assignmentId, appointments.assignmentId),
          eq(checkpoints.studentId, session.user.id),
        ),
      )
      .where(conditions)
      .orderBy(asc(appointments.startAt), asc(appointments.id))
      .limit(args.data.limit)
      .offset(offset);
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(appointments)
      .innerJoin(assignments, eq(appointments.assignmentId, assignments.id))
      .innerJoin(courseSections, eq(assignments.sectionId, courseSections.id))
      .innerJoin(academicTerms, eq(courseSections.termId, academicTerms.id))
      .innerJoin(assignmentStudents, eq(assignmentStudents.assignmentId, assignments.id))
      .innerJoin(
        availableInstructorEnrollment,
        and(
          eq(availableInstructorEnrollment.sectionId, assignments.sectionId),
          eq(availableInstructorEnrollment.userId, appointments.instructorId),
        ),
      )
      .innerJoin(availableInstructor, eq(availableInstructor.id, appointments.instructorId))
      .innerJoin(availableStudent, eq(availableStudent.id, session.user.id))
      .where(conditions);

    return listResponse(rows, total, args.data.page, args.data.limit);
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'listAvailableAppointmentsHandler',
    });
  }
}

export async function listStudentAppointmentsHandler(args: {
  data: ListStudentAppointmentsInput;
}): Promise<AppointmentListResponse | ServerError> {
  const session = await getSessionFromHeaders();
  if (!isStudent(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  try {
    const db = getDb();
    const conditions = studentConditions(args.data, session.user.id);
    const offset = (args.data.page - 1) * args.data.limit;
    const rows = await db
      .select(appointmentProjection())
      .from(appointments)
      .innerJoin(assignments, eq(appointments.assignmentId, assignments.id))
      .innerJoin(courseSections, eq(assignments.sectionId, courseSections.id))
      .innerJoin(academicTerms, eq(courseSections.termId, academicTerms.id))
      .innerJoin(assignmentStudents, eq(assignmentStudents.assignmentId, assignments.id))
      .innerJoin(
        studentListInstructorEnrollment,
        and(
          eq(studentListInstructorEnrollment.sectionId, assignments.sectionId),
          eq(studentListInstructorEnrollment.userId, appointments.instructorId),
        ),
      )
      .innerJoin(studentListInstructor, eq(studentListInstructor.id, appointments.instructorId))
      .innerJoin(studentListStudent, eq(studentListStudent.id, session.user.id))
      .leftJoin(
        checkpoints,
        and(
          eq(checkpoints.id, appointments.checkpointId),
          eq(checkpoints.assignmentId, appointments.assignmentId),
          eq(checkpoints.studentId, session.user.id),
        ),
      )
      .where(conditions)
      .orderBy(asc(appointments.startAt), asc(appointments.id))
      .limit(args.data.limit)
      .offset(offset);
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(appointments)
      .innerJoin(assignments, eq(appointments.assignmentId, assignments.id))
      .innerJoin(courseSections, eq(assignments.sectionId, courseSections.id))
      .innerJoin(academicTerms, eq(courseSections.termId, academicTerms.id))
      .innerJoin(assignmentStudents, eq(assignmentStudents.assignmentId, assignments.id))
      .innerJoin(
        studentListInstructorEnrollment,
        and(
          eq(studentListInstructorEnrollment.sectionId, assignments.sectionId),
          eq(studentListInstructorEnrollment.userId, appointments.instructorId),
        ),
      )
      .innerJoin(studentListInstructor, eq(studentListInstructor.id, appointments.instructorId))
      .innerJoin(studentListStudent, eq(studentListStudent.id, session.user.id))
      .where(conditions);

    return listResponse(rows, total, args.data.page, args.data.limit);
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'listStudentAppointmentsHandler',
    });
  }
}
