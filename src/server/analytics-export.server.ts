// CSV export handler implementations (server-only, never client-bundled)
import { and, eq, isNull, sql, gte, lte, type SQL } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { users } from '@/db/schema/users';
import { assignments, assignmentStudents, checkpoints } from '@/db/schema/assignments';
import { submissions, reviews } from '@/db/schema/submissions';
import { reviewScores } from '@/db/schema/rubrics';
import { templateCheckpoints } from '@/db/schema/templates';
import { auditLog } from '@/db/schema/audit-log';
import { getSessionFromHeaders } from './auth';
import { serverError, ErrorCode } from '@/lib/errors';
import { isAdmin, isInstructor } from '@/lib/session-guards';
import { fetchGradeConfig, groupRowsByStudent, type ScoreRow } from './gradebook.server';
import { computeFinalGrade } from '@/lib/grade-computation';

export type ExportUsersCsvInput = Record<string, never>;
export type ExportAuditLogCsvInput = { dateFrom?: Date; dateTo?: Date };
export type ExportAssignmentProgressCsvInput = Record<string, never>;
export type ExportStudentProgressCsvInput = { assignmentId: number };
export type ExportReviewHistoryCsvInput = { assignmentId: number };
export type ExportRubricScoresCsvInput = { assignmentId: number };
export type ExportGradebookCsvInput = { assignmentId: number };

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  // Prefix formula-triggering characters to prevent CSV injection (CWE-1236)
  const str = String(value);
  const sanitized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  if (sanitized.includes(',') || sanitized.includes('"') || sanitized.includes('\n')) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

function buildCsv(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map(escapeCsvValue).join(',');
  const dataLines = rows.map((row) => row.map(escapeCsvValue).join(','));
  return [headerLine, ...dataLines].join('\n');
}

export async function exportUsersCsvHandler({ data }: { data: ExportUsersCsvInput }) {
  const session = await getSessionFromHeaders();
  if (!isAdmin(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const db = getDb();
  try {
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        deletedAt: users.deletedAt,
        createdAt: users.createdAt,
      })
      .from(users);

    const csvRows = rows.map((r) => [
      r.id,
      r.name,
      r.email,
      r.role,
      r.deletedAt ? 'Deleted' : 'Active',
      r.createdAt ? r.createdAt.toISOString() : '',
    ]);

    return buildCsv(['ID', 'Name', 'Email', 'Role', 'Status', 'Created At'], csvRows);
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'exportUsersCsvHandler',
    });
  }
}

export async function exportAuditLogCsvHandler({ data }: { data: ExportAuditLogCsvInput }) {
  const session = await getSessionFromHeaders();
  if (!isAdmin(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const db = getDb();
  const { dateFrom, dateTo } = data;

  try {
    const conditions: SQL[] = [];
    if (dateFrom) conditions.push(gte(auditLog.createdAt, new Date(dateFrom)));
    if (dateTo) conditions.push(lte(auditLog.createdAt, new Date(dateTo)));

    const query = db
      .select({
        createdAt: auditLog.createdAt,
        action: auditLog.action,
        actorName: users.name,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        details: auditLog.details,
      })
      .from(auditLog)
      .leftJoin(users, sql`${auditLog.actorId} = ${users.id}`)
      .orderBy(sql`${auditLog.createdAt} DESC`);

    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    const rows = await query;

    const csvRows = rows.map((r) => [
      r.createdAt ? r.createdAt.toISOString() : '',
      r.action,
      r.actorName ?? '',
      r.entityType,
      r.entityId,
      r.details ? JSON.stringify(r.details) : '',
    ]);

    return buildCsv(
      ['Timestamp', 'Action', 'Actor', 'Entity Type', 'Entity ID', 'Details'],
      csvRows,
    );
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'exportAuditLogCsvHandler',
    });
  }
}

export async function exportAssignmentProgressCsvHandler({
  data,
}: {
  data: ExportAssignmentProgressCsvInput;
}) {
  const session = await getSessionFromHeaders();
  if (!isAdmin(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const db = getDb();
  try {
    const rows = await db
      .select({
        assignmentTitle: assignments.title,
        studentName: users.name,
        checkpointState: checkpoints.state,
        checkpointOrder: checkpoints.order,
      })
      .from(assignments)
      .innerJoin(assignmentStudents, eq(assignmentStudents.assignmentId, assignments.id))
      .innerJoin(users, eq(users.id, assignmentStudents.studentId))
      .innerJoin(checkpoints, eq(checkpoints.assignmentId, assignments.id))
      .where(and(eq(checkpoints.studentId, users.id), isNull(assignments.deletedAt)))
      .orderBy(assignments.title, users.name, checkpoints.order);

    // Group by (assignmentTitle, studentName)
    const grouped = new Map<string, { states: string[]; passed: number; total: number }>();
    for (const row of rows) {
      const key = `${row.assignmentTitle}\0${row.studentName}`;
      if (!grouped.has(key)) {
        grouped.set(key, { states: [], passed: 0, total: 0 });
      }
      const entry = grouped.get(key)!;
      entry.states.push(row.checkpointState);
      entry.total++;
      if (row.checkpointState === 'passed') entry.passed++;
    }

    const csvRows = Array.from(grouped.entries()).map(([key, val]) => {
      const [assignmentTitle, studentName] = key.split('\0');
      const completion = val.total > 0 ? Math.round((val.passed / val.total) * 100) : 0;
      return [assignmentTitle, studentName, val.states.join(','), `${completion}%`];
    });

    return buildCsv(
      ['Assignment Title', 'Student Name', 'Checkpoint States', 'Completion Percentage'],
      csvRows,
    );
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'exportAssignmentProgressCsvHandler',
    });
  }
}

export async function exportStudentProgressCsvHandler({
  data,
}: {
  data: ExportStudentProgressCsvInput;
}) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const instructorId = session.user.id;
  const { assignmentId } = data;
  const db = getDb();

  try {
    // Ownership check: assignment must belong to this instructor
    const assignment = await db
      .select({ id: assignments.id, instructorId: assignments.instructorId })
      .from(assignments)
      .where(and(eq(assignments.id, assignmentId), eq(assignments.instructorId, instructorId)))
      .limit(1);

    if (!assignment[0]) {
      return serverError(ErrorCode.NOT_FOUND, 'Assignment not found');
    }

    const rows = await db
      .select({
        studentName: users.name,
        checkpointState: checkpoints.state,
        checkpointOrder: checkpoints.order,
      })
      .from(checkpoints)
      .innerJoin(users, eq(users.id, checkpoints.studentId))
      .where(eq(checkpoints.assignmentId, assignmentId))
      .orderBy(users.name, checkpoints.order);

    // Group by student
    const grouped = new Map<string, { states: string[]; passed: number; total: number }>();
    for (const row of rows) {
      if (!grouped.has(row.studentName)) {
        grouped.set(row.studentName, { states: [], passed: 0, total: 0 });
      }
      const entry = grouped.get(row.studentName)!;
      entry.states.push(row.checkpointState);
      entry.total++;
      if (row.checkpointState === 'passed') entry.passed++;
    }

    const csvRows = Array.from(grouped.entries()).map(([studentName, val]) => {
      const completion = val.total > 0 ? Math.round((val.passed / val.total) * 100) : 0;
      return [studentName, val.states.join(','), `${completion}%`];
    });

    return buildCsv(['Student Name', 'Checkpoint States', 'Completion Percentage'], csvRows);
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'exportStudentProgressCsvHandler',
    });
  }
}

export async function exportReviewHistoryCsvHandler({
  data,
}: {
  data: ExportReviewHistoryCsvInput;
}) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const instructorId = session.user.id;
  const { assignmentId } = data;
  const db = getDb();

  try {
    // Ownership check: assignment must belong to this instructor
    const assignment = await db
      .select({ id: assignments.id })
      .from(assignments)
      .where(and(eq(assignments.id, assignmentId), eq(assignments.instructorId, instructorId)))
      .limit(1);

    if (!assignment[0]) {
      return serverError(ErrorCode.NOT_FOUND, 'Assignment not found');
    }

    const rows = await db
      .select({
        submissionId: submissions.id,
        studentName: users.name,
        decision: reviews.decision,
        comment: reviews.comment,
        reviewedAt: reviews.reviewedAt,
        uploadedAt: submissions.uploadedAt,
      })
      .from(reviews)
      .innerJoin(submissions, eq(submissions.id, reviews.submissionId))
      .innerJoin(checkpoints, eq(checkpoints.id, submissions.checkpointId))
      .innerJoin(users, eq(users.id, submissions.uploadedBy))
      .where(
        and(
          eq(checkpoints.assignmentId, assignmentId),
          eq(reviews.instructorId, instructorId),
          sql`${reviews.reviewedAt} IS NOT NULL`,
        ),
      )
      .orderBy(sql`${reviews.reviewedAt} DESC`);

    const csvRows = rows.map((r) => {
      const responseTimeHours =
        r.reviewedAt && r.uploadedAt
          ? Math.round(
              ((r.reviewedAt.getTime() - r.uploadedAt.getTime()) / (1000 * 60 * 60)) * 10,
            ) / 10
          : '';
      return [
        r.submissionId,
        r.studentName,
        r.decision,
        r.comment ?? '',
        r.reviewedAt ? r.reviewedAt.toISOString() : '',
        responseTimeHours,
      ];
    });

    return buildCsv(
      ['Submission ID', 'Student', 'Decision', 'Comment', 'Reviewed At', 'Response Time (Hours)'],
      csvRows,
    );
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'exportReviewHistoryCsvHandler',
    });
  }
}

export async function exportRubricScoresCsvHandler({ data }: { data: ExportRubricScoresCsvInput }) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const instructorId = session.user.id;
  const { assignmentId } = data;
  const db = getDb();

  try {
    // Ownership check: assignment must belong to this instructor
    const assignment = await db
      .select({ id: assignments.id })
      .from(assignments)
      .where(and(eq(assignments.id, assignmentId), eq(assignments.instructorId, instructorId)))
      .limit(1);

    if (!assignment[0]) {
      return serverError(ErrorCode.NOT_FOUND, 'Assignment not found');
    }

    const rows = await db
      .select({
        studentName: users.name,
        checkpointName: checkpoints.name,
        criterionTitle: reviewScores.criterionTitle,
        score: reviewScores.score,
        weight: reviewScores.weight,
        levelLabel: reviewScores.levelLabel,
        comment: reviewScores.comment,
      })
      .from(reviewScores)
      .innerJoin(reviews, eq(reviewScores.reviewId, reviews.id))
      .innerJoin(submissions, eq(submissions.id, reviews.submissionId))
      .innerJoin(checkpoints, eq(checkpoints.id, submissions.checkpointId))
      .innerJoin(users, eq(users.id, submissions.uploadedBy))
      .where(
        and(
          eq(checkpoints.assignmentId, assignmentId),
          eq(reviews.instructorId, instructorId),
          sql`${reviews.reviewedAt} IS NOT NULL`,
        ),
      )
      .orderBy(users.name, checkpoints.order, reviewScores.criterionTitle);

    const csvRows = rows.map((r) => [
      r.studentName,
      r.checkpointName,
      r.criterionTitle,
      r.score,
      r.weight,
      r.levelLabel ?? '',
      r.comment ?? '',
    ]);

    return buildCsv(
      ['Student', 'Checkpoint', 'Criterion', 'Score', 'Weight', 'Level', 'Comment'],
      csvRows,
    );
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'exportRubricScoresCsvHandler',
    });
  }
}

export async function exportGradebookCsvHandler({ data }: { data: ExportGradebookCsvInput }) {
  const session = await getSessionFromHeaders();
  if (!isAdmin(session)) {
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  }

  const { assignmentId } = data;
  const db = getDb();

  try {
    const assignment = await db
      .select({ id: assignments.id })
      .from(assignments)
      .where(eq(assignments.id, assignmentId))
      .limit(1);

    if (!assignment[0]) {
      return serverError(ErrorCode.NOT_FOUND, 'Assignment not found');
    }

    const config = await fetchGradeConfig(db, assignmentId);

    const rows = (await db
      .select({
        studentId: users.id,
        studentName: users.name,
        checkpointId: checkpoints.id,
        checkpointName: checkpoints.name,
        templateCheckpointId: checkpoints.templateCheckpointId,
        order: checkpoints.order,
        state: checkpoints.state,
        gradingType: templateCheckpoints.gradingType,
        criterionId: reviewScores.criterionId,
        criterionTitle: reviewScores.criterionTitle,
        score: reviewScores.score,
        weight: reviewScores.weight,
        rubricLevelId: reviewScores.rubricLevelId,
        levelLabel: reviewScores.levelLabel,
      })
      .from(checkpoints)
      .innerJoin(users, eq(users.id, checkpoints.studentId))
      .leftJoin(templateCheckpoints, eq(templateCheckpoints.id, checkpoints.templateCheckpointId))
      .leftJoin(submissions, eq(submissions.checkpointId, checkpoints.id))
      .leftJoin(reviews, eq(reviews.submissionId, submissions.id))
      .leftJoin(reviewScores, eq(reviewScores.reviewId, reviews.id))
      .where(eq(checkpoints.assignmentId, assignmentId))
      .orderBy(users.name, checkpoints.order)) as ScoreRow[];

    const studentMap = groupRowsByStudent(rows);

    const studentGrades = Array.from(studentMap.values()).map(
      ({ studentName, checkpoints: cps }) => ({
        studentName,
        result: computeFinalGrade(cps, config),
      }),
    );

    const checkpointCols = new Map<string, number>();
    for (const cp of studentGrades.flatMap((s) => s.result.contributingCheckpoints))
      if (!checkpointCols.has(cp.checkpointName)) checkpointCols.set(cp.checkpointName, cp.order);
    const sortedCols = Array.from(checkpointCols.entries())
      .sort(([, a], [, b]) => a - b)
      .map(([name]) => name);

    const headers = ['Student Name', ...sortedCols, 'Final Score', 'Letter Grade', 'Status'];

    const csvRows = studentGrades.map(({ studentName, result }) => {
      const scoreMap = new Map(
        result.contributingCheckpoints.map((cp) => [cp.checkpointName, cp.score]),
      );
      return [
        studentName,
        ...sortedCols.map((c) => scoreMap.get(c) ?? ''),
        result.numericScore ?? '',
        result.letterGrade ?? '',
        result.status,
      ];
    });

    return buildCsv(headers, csvRows);
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'exportGradebookCsvHandler',
    });
  }
}
