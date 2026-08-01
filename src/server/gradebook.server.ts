// Gradebook handler implementations (server-only, never client-bundled).
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { assignments, assignmentStudents, checkpoints } from '@/db/schema/assignments';
import { submissions, reviews } from '@/db/schema/submissions';
import { reviewScores } from '@/db/schema/rubrics';
import { templateCheckpoints } from '@/db/schema/templates';
import { assignmentGradeConfig, finalGrades, gradeReleaseSnapshots } from '@/db/schema/gradebook';
import { users } from '@/db/schema/users';
import { getSessionFromHeaders } from './auth';
import { serverError, ErrorCode } from '@/lib/errors';
import { logAuditEvent } from '@/lib/audit';
import { computeFinalGrade } from '@/lib/grade-computation';
import type {
  CheckpointGradeInput,
  AssignmentGradeConfig,
  ContributingCheckpoint,
} from '@/lib/grade-computation';
import { isAdmin, isInstructor } from '@/lib/session-guards';
import { logger } from '@/lib/logger';

// ---- Shared Helpers ----

/** Shape of a flat checkpoint+review_score query row (from left joins). */
export interface ScoreRow {
  studentId?: string;
  studentName?: string;
  checkpointId: number;
  checkpointName: string;
  templateCheckpointId: number | null;
  order: number;
  state: string;
  gradingType: 'numeric' | 'qualitative' | null;
  criterionId: number | null;
  criterionTitle: string | null;
  score: number | null;
  weight: number | null;
  rubricLevelId: number | null;
  levelLabel: string | null;
}

/** Fetch and cast grade config for an assignment. Returns null if no config exists. */
export interface GradebookConfig extends AssignmentGradeConfig {
  releaseStatus: 'draft' | 'published' | null;
  activeReleaseVersion: number | null;
  publishedAt: Date | null;
}

export async function fetchGradeConfig(
  db: ReturnType<typeof getDb>,
  assignmentId: number,
): Promise<GradebookConfig | null> {
  const rows = await db
    .select({
      gradingScheme: assignmentGradeConfig.gradingScheme,
      customWeights: assignmentGradeConfig.customWeights,
      letterGradeBounds: assignmentGradeConfig.letterGradeBounds,
      releaseStatus: assignmentGradeConfig.releaseStatus,
      activeReleaseVersion: assignmentGradeConfig.activeReleaseVersion,
      publishedAt: assignmentGradeConfig.publishedAt,
    })
    .from(assignmentGradeConfig)
    .where(eq(assignmentGradeConfig.assignmentId, assignmentId))
    .limit(1);

  if (!rows[0]) return null;
  return {
    gradingScheme: rows[0].gradingScheme as AssignmentGradeConfig['gradingScheme'],
    customWeights: rows[0].customWeights as Record<string, number> | null,
    letterGradeBounds: rows[0].letterGradeBounds as Record<string, number>,
    releaseStatus: (rows[0].releaseStatus as 'draft' | 'published' | null | undefined) ?? null,
    activeReleaseVersion: rows[0].activeReleaseVersion ?? null,
    publishedAt: rows[0].publishedAt ?? null,
  };
}

/** Group flat query rows into CheckpointGradeInput[] (grouped by checkpointId). */
export function groupRowsToCheckpoints(rows: ScoreRow[]): CheckpointGradeInput[] {
  const map = new Map<number, CheckpointGradeInput>();
  for (const row of rows) {
    if (!map.has(row.checkpointId)) {
      map.set(row.checkpointId, {
        checkpointId: row.checkpointId,
        checkpointName: row.checkpointName,
        templateCheckpointId: row.templateCheckpointId,
        order: row.order,
        state: row.state as CheckpointGradeInput['state'],
        gradingType: row.gradingType,
        reviewScores: [],
      });
    }
    if (row.criterionId !== null) {
      map.get(row.checkpointId)!.reviewScores.push({
        criterionId: row.criterionId,
        criterionTitle: row.criterionTitle!,
        score: row.score!,
        weight: row.weight!,
        rubricLevelId: row.rubricLevelId,
        levelLabel: row.levelLabel,
      });
    }
  }
  return Array.from(map.values());
}

/** Group flat rows by studentId, returning Map<studentId, { studentName, checkpoints }>. */
export function groupRowsByStudent(
  rows: ScoreRow[],
): Map<string, { studentName: string; checkpoints: CheckpointGradeInput[] }> {
  const byStudent = new Map<string, ScoreRow[]>();
  for (const row of rows) {
    const sid = row.studentId!;
    if (!byStudent.has(sid)) byStudent.set(sid, []);
    byStudent.get(sid)!.push(row);
  }
  const result = new Map<string, { studentName: string; checkpoints: CheckpointGradeInput[] }>();
  for (const [studentId, studentRows] of byStudent) {
    result.set(studentId, {
      studentName: studentRows[0].studentName ?? '',
      checkpoints: groupRowsToCheckpoints(studentRows),
    });
  }
  return result;
}

// ---- Handlers ----

/** Get a student's final grade. Ownership-verified, does NOT auto-create config on read. */
export async function getStudentFinalGradeHandler({ data }: { data: { assignmentId: number } }) {
  const session = await getSessionFromHeaders();
  if (!session) return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');

  const { assignmentId } = data;
  const db = getDb();

  try {
    const assigned = await db
      .select({ assignmentId: assignmentStudents.assignmentId })
      .from(assignmentStudents)
      .where(
        and(
          eq(assignmentStudents.assignmentId, assignmentId),
          eq(assignmentStudents.studentId, session.user.id),
        ),
      )
      .limit(1);

    if (!assigned[0]) return serverError(ErrorCode.NOT_FOUND, 'Assignment not found');

    const config = await fetchGradeConfig(db, assignmentId);
    if (!config) return null;

    if (config.releaseStatus === 'draft') {
      return { available: false, reason: 'not_yet_released' as const };
    }

    if (config.releaseStatus === 'published') {
      if (config.activeReleaseVersion === null) {
        return { available: false, reason: 'not_yet_released' as const };
      }

      const snapshots = await db
        .select({
          releaseVersion: gradeReleaseSnapshots.releaseVersion,
          numericScore: gradeReleaseSnapshots.numericScore,
          letterGrade: gradeReleaseSnapshots.letterGrade,
          status: gradeReleaseSnapshots.status,
          contributingCheckpoints: gradeReleaseSnapshots.contributingCheckpoints,
          publishedAt: gradeReleaseSnapshots.publishedAt,
        })
        .from(gradeReleaseSnapshots)
        .where(
          and(
            eq(gradeReleaseSnapshots.assignmentId, assignmentId),
            eq(gradeReleaseSnapshots.studentId, session.user.id),
            eq(gradeReleaseSnapshots.releaseVersion, config.activeReleaseVersion),
          ),
        )
        .limit(1);

      const snapshot = snapshots[0];
      if (!snapshot) return { available: false, reason: 'not_yet_released' as const };

      return {
        available: true as const,
        releaseVersion: snapshot.releaseVersion,
        numericScore: Number(snapshot.numericScore),
        letterGrade: snapshot.letterGrade,
        status: snapshot.status,
        contributingCheckpoints: snapshot.contributingCheckpoints as ContributingCheckpoint[],
        publishedAt: snapshot.publishedAt,
      };
    }

    const rows = (await db
      .select({
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
      .leftJoin(templateCheckpoints, eq(templateCheckpoints.id, checkpoints.templateCheckpointId))
      .leftJoin(submissions, eq(submissions.checkpointId, checkpoints.id))
      .leftJoin(reviews, eq(reviews.submissionId, submissions.id))
      .leftJoin(reviewScores, eq(reviewScores.reviewId, reviews.id))
      .where(
        and(eq(checkpoints.assignmentId, assignmentId), eq(checkpoints.studentId, session.user.id)),
      )
      .orderBy(checkpoints.order)) as ScoreRow[];

    return computeFinalGrade(groupRowsToCheckpoints(rows), config);
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'getStudentFinalGradeHandler',
    });
  }
}

/** Get gradebook view for an assignment. Instructor ownership-verified; admin can view any. */
export async function getAssignmentGradebookHandler({ data }: { data: { assignmentId: number } }) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session) && !isAdmin(session))
    return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');

  const { assignmentId } = data;
  const db = getDb();

  try {
    const assignment = await db
      .select({ id: assignments.id })
      .from(assignments)
      .where(
        isInstructor(session)
          ? and(eq(assignments.id, assignmentId), eq(assignments.instructorId, session.user.id))
          : eq(assignments.id, assignmentId),
      )
      .limit(1);

    if (!assignment[0]) return serverError(ErrorCode.NOT_FOUND, 'Assignment not found');

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
    const students = Array.from(studentMap.entries()).map(
      ([studentId, { studentName, checkpoints: cp }]) => {
        const result = config ? computeFinalGrade(cp, config) : null;
        return {
          studentId,
          studentName,
          checkpoints: result?.contributingCheckpoints ?? [],
          finalGrade: result,
        };
      },
    );
    students.sort((a, b) => a.studentName.localeCompare(b.studentName));

    return { config, students, isAdmin: isAdmin(session) };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'getAssignmentGradebookHandler',
    });
  }
}

/** Save (upsert) grade configuration. Admin-only, audit-logged. */
export async function saveGradeConfigHandler({
  data,
}: {
  data: {
    assignmentId: number;
    gradingScheme: 'equal_weight' | 'custom_weight';
    customWeights: Record<string, number> | null;
    letterGradeBounds: Record<string, number>;
  };
}) {
  const session = await getSessionFromHeaders();
  if (!isAdmin(session)) return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');

  const { assignmentId, gradingScheme, customWeights, letterGradeBounds } = data;
  const db = getDb();

  try {
    const existing = await db
      .select({
        gradingScheme: assignmentGradeConfig.gradingScheme,
        customWeights: assignmentGradeConfig.customWeights,
        letterGradeBounds: assignmentGradeConfig.letterGradeBounds,
      })
      .from(assignmentGradeConfig)
      .where(eq(assignmentGradeConfig.assignmentId, assignmentId))
      .limit(1);

    await db
      .insert(assignmentGradeConfig)
      .values({
        assignmentId,
        gradingScheme,
        customWeights,
        letterGradeBounds,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: assignmentGradeConfig.assignmentId,
        set: { gradingScheme, customWeights, letterGradeBounds, updatedAt: new Date() },
      });

    try {
      await logAuditEvent({
        actorId: session.user.id,
        action: 'gradebook.config_updated',
        entityType: 'assignment_grade_config',
        entityId: String(assignmentId),
        details: {
          previous: existing[0] ?? null,
          new: { gradingScheme, customWeights, letterGradeBounds },
        },
      });
    } catch (auditErr) {
      logger.error({
        event: 'advisory_failed',
        handler: 'saveGradeConfigHandler',
        error: auditErr instanceof Error ? auditErr.message : String(auditErr),
      });
    }

    return { success: true };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'saveGradeConfigHandler',
    });
  }
}

/** Recompute final grades for all students. Admin-only. */
export async function recomputeAllGradesHandler({ data }: { data: { assignmentId: number } }) {
  const session = await getSessionFromHeaders();
  if (!isAdmin(session)) return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');

  const { assignmentId } = data;
  const db = getDb();

  try {
    const students = await db
      .select({ studentId: users.id })
      .from(assignmentStudents)
      .innerJoin(users, eq(users.id, assignmentStudents.studentId))
      .where(eq(assignmentStudents.assignmentId, assignmentId));

    if (students.length === 0) return { success: true, count: 0 };

    const config = await fetchGradeConfig(db, assignmentId);
    if (!config) return { success: true, count: 0 };

    const rows = (await db
      .select({
        studentId: checkpoints.studentId,
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
      .leftJoin(templateCheckpoints, eq(templateCheckpoints.id, checkpoints.templateCheckpointId))
      .leftJoin(submissions, eq(submissions.checkpointId, checkpoints.id))
      .leftJoin(reviews, eq(reviews.submissionId, submissions.id))
      .leftJoin(reviewScores, eq(reviewScores.reviewId, reviews.id))
      .where(eq(checkpoints.assignmentId, assignmentId))
      .orderBy(checkpoints.studentId, checkpoints.order)) as ScoreRow[];

    const studentMap = groupRowsByStudent(rows);
    let count = 0;
    await db.transaction(async (tx) => {
      for (const { studentId } of students) {
        const checkpointInputs = studentMap.get(studentId)?.checkpoints ?? [];
        const result = computeFinalGrade(checkpointInputs, config);
        const numericScore = result.numericScore !== null ? String(result.numericScore) : null;

        await tx
          .insert(finalGrades)
          .values({
            assignmentId,
            studentId,
            numericScore,
            letterGrade: result.letterGrade,
            status: result.status,
            contributingCheckpoints: result.contributingCheckpoints,
            computedAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [finalGrades.assignmentId, finalGrades.studentId],
            set: {
              numericScore,
              letterGrade: result.letterGrade,
              status: result.status,
              contributingCheckpoints: result.contributingCheckpoints,
              computedAt: new Date(),
              updatedAt: new Date(),
            },
          });
        count++;
      }
    });

    return { success: true, count };
  } catch (err) {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error', {
      cause: err instanceof Error ? err.message : String(err),
      handler: 'recomputeAllGradesHandler',
    });
  }
}
