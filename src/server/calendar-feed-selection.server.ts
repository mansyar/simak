import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { Db } from '@/db';
import { assignmentStudents, assignments, checkpoints } from '@/db/schema/assignments';
import { appointments } from '@/db/schema/appointments';

export type CalendarFeedRow = {
  assignmentId: number;
  assignmentTitle: string;
  assignmentFinalDeadline: Date;
  assignmentDeletedAt: Date | null;
  checkpointId: number;
  checkpointName: string;
  assignmentStudentId: string;
  checkpointStudentId: string;
  checkpointState: string;
  checkpointDueDate: Date | null;
};

export type CalendarFeedEvent = {
  uid: string;
  kind: 'checkpoint' | 'assignment-final' | 'appointment';
  summary: string;
  startsAt: Date;
  endsAt?: Date;
};

export type CalendarAppointmentRow = {
  appointmentId: number;
  assignmentId: number;
  assignmentTitle: string;
  assignmentStatus: string;
  assignmentDeletedAt: Date | null;
  checkpointId: number | null;
  checkpointName: string | null;
  studentId: string | null;
  status: 'available' | 'booked' | 'cancelled' | 'completed' | 'no_show';
  startAt: Date;
  endAt: Date;
};

export function buildCalendarFeedEvents(rows: CalendarFeedRow[], studentId: string) {
  const eligibleRows = rows.filter(
    (row) =>
      row.checkpointStudentId === studentId &&
      row.assignmentStudentId === studentId &&
      row.assignmentDeletedAt === null &&
      row.checkpointState !== 'passed',
  );

  const events: CalendarFeedEvent[] = eligibleRows.flatMap((row) => {
    const dueDate = row.checkpointDueDate;
    if (dueDate === null) return [];

    return [
      {
        uid: `checkpoint-${row.checkpointId}@simak`,
        kind: 'checkpoint' as const,
        summary: `${row.assignmentTitle} — ${row.checkpointName}`,
        startsAt: dueDate,
      },
    ];
  });

  const finalEvents = new Map<number, CalendarFeedEvent>();
  for (const row of eligibleRows) {
    if (!finalEvents.has(row.assignmentId)) {
      finalEvents.set(row.assignmentId, {
        uid: `assignment-final-${row.assignmentId}@simak`,
        kind: 'assignment-final',
        summary: `${row.assignmentTitle} — Final deadline`,
        startsAt: row.assignmentFinalDeadline,
      });
    }
  }

  return [...events, ...finalEvents.values()];
}

export function buildAppointmentFeedEvents(
  rows: CalendarAppointmentRow[],
  studentId: string,
  now = new Date(),
) {
  return rows
    .filter(
      (row) =>
        row.studentId === studentId &&
        row.status === 'booked' &&
        row.assignmentStatus === 'active' &&
        row.assignmentDeletedAt === null &&
        row.startAt > now,
    )
    .map((row) => ({
      uid: `appointment-${row.appointmentId}@simak`,
      kind: 'appointment' as const,
      summary: row.checkpointName
        ? `${row.assignmentTitle} — ${row.checkpointName}`
        : `${row.assignmentTitle} — Advising appointment`,
      startsAt: row.startAt,
      endsAt: row.endAt,
    }));
}

export async function getCalendarFeedEvents(db: Db, studentId: string, now = new Date()) {
  const rows = await db
    .select({
      assignmentId: assignments.id,
      assignmentTitle: assignments.title,
      assignmentFinalDeadline: assignments.finalDeadline,
      assignmentDeletedAt: assignments.deletedAt,
      checkpointId: checkpoints.id,
      checkpointName: checkpoints.name,
      assignmentStudentId: assignmentStudents.studentId,
      checkpointStudentId: checkpoints.studentId,
      checkpointState: checkpoints.state,
      checkpointDueDate: checkpoints.dueDate,
    })
    .from(checkpoints)
    .innerJoin(assignments, eq(checkpoints.assignmentId, assignments.id))
    .innerJoin(
      assignmentStudents,
      and(
        eq(assignmentStudents.assignmentId, checkpoints.assignmentId),
        eq(assignmentStudents.studentId, studentId),
      ),
    )
    .where(
      and(
        eq(checkpoints.studentId, studentId),
        eq(assignments.status, 'active'),
        isNull(assignments.deletedAt),
        sql`${checkpoints.state} <> 'passed'`,
      ),
    );

  const appointmentRows = await db
    .select({
      appointmentId: appointments.id,
      assignmentId: assignments.id,
      assignmentTitle: assignments.title,
      assignmentStatus: assignments.status,
      assignmentDeletedAt: assignments.deletedAt,
      checkpointId: appointments.checkpointId,
      checkpointName: checkpoints.name,
      studentId: appointments.studentId,
      status: appointments.status,
      startAt: appointments.startAt,
      endAt: appointments.endAt,
    })
    .from(appointments)
    .innerJoin(assignments, eq(appointments.assignmentId, assignments.id))
    .innerJoin(
      assignmentStudents,
      and(
        eq(assignmentStudents.assignmentId, appointments.assignmentId),
        eq(assignmentStudents.studentId, studentId),
      ),
    )
    .leftJoin(checkpoints, eq(appointments.checkpointId, checkpoints.id))
    .where(
      and(
        eq(appointments.studentId, studentId),
        eq(appointments.status, 'booked'),
        gt(appointments.startAt, now),
        eq(assignments.status, 'active'),
        isNull(assignments.deletedAt),
      ),
    );

  return [
    ...buildCalendarFeedEvents(rows, studentId),
    ...buildAppointmentFeedEvents(appointmentRows, studentId, now),
  ];
}
