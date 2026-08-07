import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Db } from '@/db';
import { assignmentStudents, assignments, checkpoints } from '@/db/schema/assignments';

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
  kind: 'checkpoint' | 'assignment-final';
  summary: string;
  startsAt: Date;
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

export async function getCalendarFeedEvents(db: Db, studentId: string) {
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

  return buildCalendarFeedEvents(rows, studentId);
}
