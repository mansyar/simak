// Grade release lifecycle handlers (server-only, never client-bundled).
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { sectionEnrollments } from '@/db/schema/academic-context';
import { assignments, assignmentStudents } from '@/db/schema/assignments';
import { assignmentGradeConfig, finalGrades, gradeReleaseSnapshots } from '@/db/schema/gradebook';
import { users } from '@/db/schema/users';
import { getSessionFromHeaders } from './auth';
import { isServerError, serverError, ErrorCode } from '@/lib/errors';
import { logAuditEvent } from '@/lib/audit';
import { isInstructor } from '@/lib/session-guards';
import { logger } from '@/lib/logger';
import {
  persistAcademicRecordsForReleaseInTransaction,
  persistWithdrawnAcademicRecordsForReleaseInTransaction,
  AcademicRecordDomainError,
} from './academic-records.server';
import type { PublishGradeReleaseSchema } from './gradebook';
import type { z } from 'zod';

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type ReleaseDb = Db | Tx;
type ReleaseStatus = 'draft' | 'published';

interface ReleaseGradeRow {
  studentId: string;
  studentName: string;
  numericScore: string | number | null;
  letterGrade: string | null;
  status: 'complete' | 'incomplete' | 'in_progress' | null;
  contributingCheckpoints: unknown;
}

interface EligibleReleaseGradeRow extends ReleaseGradeRow {
  numericScore: string | number;
  letterGrade: string;
  status: 'complete';
}

interface ReleaseConfigRow {
  releaseStatus: ReleaseStatus;
  activeReleaseVersion: number | null;
  publishedAt: Date | null;
}

function validateAssignmentId(assignmentId: number) {
  return Number.isInteger(assignmentId) && assignmentId > 0;
}

async function getOwnedAssignment(
  db: ReleaseDb,
  assignmentId: number,
  instructorId: string,
  lock = false,
) {
  const query = db
    .select({
      id: assignments.id,
      instructorId: assignments.instructorId,
      sectionId: assignments.sectionId,
      isTranscriptSource: assignments.isTranscriptSource,
    })
    .from(assignments)
    .innerJoin(
      sectionEnrollments,
      and(
        eq(sectionEnrollments.sectionId, assignments.sectionId),
        eq(sectionEnrollments.userId, instructorId),
        eq(sectionEnrollments.role, 'instructor'),
        eq(sectionEnrollments.isActive, true),
      ),
    )
    .where(and(eq(assignments.id, assignmentId), eq(assignments.instructorId, instructorId)));

  const rows = lock
    ? await query.for('update', { of: assignments }).limit(1)
    : await query.limit(1);

  return rows[0] ?? null;
}

async function getReleaseConfig(db: ReleaseDb, assignmentId: number, lock = false) {
  const query = db
    .select({
      releaseStatus: assignmentGradeConfig.releaseStatus,
      activeReleaseVersion: assignmentGradeConfig.activeReleaseVersion,
      publishedAt: assignmentGradeConfig.publishedAt,
    })
    .from(assignmentGradeConfig)
    .where(eq(assignmentGradeConfig.assignmentId, assignmentId));

  const rows = lock
    ? await query.for('update', { of: assignmentGradeConfig }).limit(1)
    : await query.limit(1);
  const row = rows[0];
  if (!row) return null;

  return {
    releaseStatus: row.releaseStatus as ReleaseStatus,
    activeReleaseVersion: row.activeReleaseVersion ?? null,
    publishedAt: row.publishedAt ?? null,
  } satisfies ReleaseConfigRow;
}

async function getEnrolledGrades(db: ReleaseDb, assignmentId: number) {
  return (await db
    .select({
      studentId: assignmentStudents.studentId,
      studentName: users.name,
      numericScore: finalGrades.numericScore,
      letterGrade: finalGrades.letterGrade,
      status: finalGrades.status,
      contributingCheckpoints: finalGrades.contributingCheckpoints,
    })
    .from(assignmentStudents)
    .innerJoin(users, eq(users.id, assignmentStudents.studentId))
    .leftJoin(
      finalGrades,
      and(
        eq(finalGrades.assignmentId, assignmentStudents.assignmentId),
        eq(finalGrades.studentId, assignmentStudents.studentId),
      ),
    )
    .where(eq(assignmentStudents.assignmentId, assignmentId))
    .orderBy(users.name)) as ReleaseGradeRow[];
}

function classifyGrades(rows: ReleaseGradeRow[]) {
  const eligible: EligibleReleaseGradeRow[] = [];
  const incomplete: ReleaseGradeRow[] = [];
  const missing: ReleaseGradeRow[] = [];

  for (const row of rows) {
    if (row.status === 'complete' && row.numericScore !== null && row.letterGrade !== null) {
      eligible.push({
        ...row,
        numericScore: row.numericScore,
        letterGrade: row.letterGrade,
        status: 'complete',
      });
    } else if (row.status === 'incomplete') {
      incomplete.push(row);
    } else {
      missing.push(row);
    }
  }

  return { eligible, incomplete, missing };
}

function toPreflightStudent(row: ReleaseGradeRow) {
  return {
    studentId: row.studentId,
    studentName: row.studentName,
    status: row.status,
    numericScore: row.numericScore,
    letterGrade: row.letterGrade,
  };
}

async function writeReleaseAudit(
  handler: string,
  event: Parameters<typeof logAuditEvent>[0],
): Promise<void> {
  try {
    await logAuditEvent(event);
  } catch (error) {
    logger.error({
      event: 'advisory_failed',
      handler,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Return the owning instructor's current release state and grade eligibility summary. */
export async function getGradeReleasePreflightHandler({
  data,
}: {
  data: { assignmentId: number };
}) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  if (!validateAssignmentId(data.assignmentId)) {
    return serverError(ErrorCode.VALIDATION, 'Invalid assignment id');
  }

  const db = getDb();
  try {
    const assignment = await getOwnedAssignment(db, data.assignmentId, session.user.id);
    if (!assignment) return serverError(ErrorCode.NOT_FOUND, 'Assignment not found');

    const config = await getReleaseConfig(db, data.assignmentId);
    if (!config) return serverError(ErrorCode.NOT_FOUND, 'Grade release configuration not found');

    const categories = classifyGrades(await getEnrolledGrades(db, data.assignmentId));
    return {
      assignmentId: data.assignmentId,
      releaseStatus: config.releaseStatus,
      activeReleaseVersion: config.activeReleaseVersion,
      publishedAt: config.publishedAt,
      eligible: categories.eligible.map(toPreflightStudent),
      incomplete: categories.incomplete.map(toPreflightStudent),
      missing: categories.missing.map(toPreflightStudent),
      counts: {
        eligible: categories.eligible.length,
        incomplete: categories.incomplete.length,
        missing: categories.missing.length,
      },
    };
  } catch (error) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: error instanceof Error ? error.message : String(error),
      handler: 'getGradeReleasePreflightHandler',
    });
  }
}

/** Publish complete grades plus explicitly authorized incomplete outcomes. */
export async function publishGradeReleaseHandler({
  data,
}: {
  data: z.input<typeof PublishGradeReleaseSchema>;
}) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  if (!validateAssignmentId(data.assignmentId) || data.confirmed !== true) {
    return serverError(ErrorCode.VALIDATION, 'Explicit publication confirmation is required');
  }

  const db = getDb();
  try {
    const result = await db.transaction(async (tx) => {
      const assignment = await getOwnedAssignment(tx, data.assignmentId, session.user.id, true);
      if (!assignment) return serverError(ErrorCode.NOT_FOUND, 'Assignment not found');

      const config = await getReleaseConfig(tx, data.assignmentId, true);
      if (!config) return serverError(ErrorCode.NOT_FOUND, 'Grade release configuration not found');
      if (config.releaseStatus === 'published') {
        return serverError(ErrorCode.CONFLICT, 'Grade release is already published');
      }

      const categories = classifyGrades(await getEnrolledGrades(tx, data.assignmentId));
      const incompleteOutcomes = data.incompleteOutcomes ?? [];
      const incompleteByStudent = new Map(
        categories.incomplete.map((grade) => [grade.studentId, grade]),
      );
      const invalidOutcome = incompleteOutcomes.find(
        (outcome) => !incompleteByStudent.has(outcome.studentId),
      );
      if (invalidOutcome) {
        return serverError(
          ErrorCode.VALIDATION,
          'Incomplete outcomes must reference students with incomplete grades',
        );
      }
      const releaseVersion = (config.activeReleaseVersion ?? 0) + 1;
      const publishedAt = new Date();

      const authorizedIncomplete = incompleteOutcomes.map((outcome) => ({
        grade: incompleteByStudent.get(outcome.studentId)!,
        reason: outcome.reason.trim(),
      }));
      const publishableGrades = [
        ...categories.eligible,
        ...authorizedIncomplete.map(({ grade }) => grade),
      ];
      if (publishableGrades.length > 0) {
        await tx.insert(gradeReleaseSnapshots).values(
          publishableGrades.map((grade) => ({
            assignmentId: data.assignmentId,
            studentId: grade.studentId,
            releaseVersion,
            numericScore: grade.status === 'complete' ? String(grade.numericScore) : null,
            letterGrade: grade.status === 'complete' ? grade.letterGrade : null,
            status: grade.status === 'complete' ? ('complete' as const) : ('incomplete' as const),
            contributingCheckpoints: grade.contributingCheckpoints ?? [],
            publishedAt,
          })),
        );
      }

      await tx
        .update(assignmentGradeConfig)
        .set({
          releaseStatus: 'published',
          activeReleaseVersion: releaseVersion,
          publishedAt,
          updatedAt: publishedAt,
        })
        .where(eq(assignmentGradeConfig.assignmentId, data.assignmentId));

      if (assignment.isTranscriptSource && publishableGrades.length > 0) {
        await persistAcademicRecordsForReleaseInTransaction(tx, {
          assignmentId: data.assignmentId,
          releaseVersion,
          actorId: session.user.id,
          ...(authorizedIncomplete.length > 0
            ? {
                incompleteReasons: Object.fromEntries(
                  authorizedIncomplete.map(({ grade, reason }) => [grade.studentId, reason]),
                ),
              }
            : {}),
        });
      }

      return {
        success: true,
        releaseVersion,
        publishedCount: categories.eligible.length,
        incompleteCount: authorizedIncomplete.length,
        missingCount: categories.missing.length,
      };
    });

    if (isServerError(result)) return result;

    await writeReleaseAudit('publishGradeReleaseHandler', {
      actorId: session.user.id,
      action: 'gradebook.release_published',
      entityType: 'assignment',
      entityId: String(data.assignmentId),
      details: {
        releaseVersion: result.releaseVersion,
        publishedCount: result.publishedCount,
        incompleteCount: result.incompleteCount,
        missingCount: result.missingCount,
      },
    });

    return result;
  } catch (error) {
    if (error instanceof AcademicRecordDomainError) {
      return serverError(error.code, error.message);
    }
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: error instanceof Error ? error.message : String(error),
      handler: 'publishGradeReleaseHandler',
    });
  }
}

/** Withdraw the active release while retaining its immutable snapshot history. */
export async function withdrawGradeReleaseHandler({
  data,
}: {
  data: { assignmentId: number; reason: string };
}) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  if (!validateAssignmentId(data.assignmentId) || !data.reason.trim()) {
    return serverError(ErrorCode.VALIDATION, 'A withdrawal reason is required');
  }

  const db = getDb();
  try {
    const result = await db.transaction(async (tx) => {
      const assignment = await getOwnedAssignment(tx, data.assignmentId, session.user.id, true);
      if (!assignment) return serverError(ErrorCode.NOT_FOUND, 'Assignment not found');

      const config = await getReleaseConfig(tx, data.assignmentId, true);
      if (!config) return serverError(ErrorCode.NOT_FOUND, 'Grade release configuration not found');
      if (config.releaseStatus !== 'published' || config.activeReleaseVersion === null) {
        return serverError(ErrorCode.CONFLICT, 'Grade release is not currently published');
      }

      if (assignment.isTranscriptSource) {
        await persistWithdrawnAcademicRecordsForReleaseInTransaction(tx, {
          assignmentId: data.assignmentId,
          releaseVersion: config.activeReleaseVersion,
          reason: data.reason.trim(),
          actorId: session.user.id,
        });
      }

      await tx
        .update(assignmentGradeConfig)
        .set({
          releaseStatus: 'draft',
          publishedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(assignmentGradeConfig.assignmentId, data.assignmentId));

      return { success: true, releaseVersion: config.activeReleaseVersion };
    });

    if (isServerError(result)) return result;

    await writeReleaseAudit('withdrawGradeReleaseHandler', {
      actorId: session.user.id,
      action: 'gradebook.release_withdrawn',
      entityType: 'assignment',
      entityId: String(data.assignmentId),
      details: {
        releaseVersion: result.releaseVersion,
        reason: data.reason.trim(),
      },
    });

    return { success: true };
  } catch (error) {
    if (error instanceof AcademicRecordDomainError) {
      return serverError(error.code, error.message);
    }
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: error instanceof Error ? error.message : String(error),
      handler: 'withdrawGradeReleaseHandler',
    });
  }
}
