import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '@/db';
import { assignments, checkpoints } from '@/db/schema/assignments';
import { consultations } from '@/db/schema/consultations';
import { reviews, submissions } from '@/db/schema/submissions';
import { users } from '@/db/schema/users';
import {
  computeStudentRisk,
  type CheckpointRiskData,
  type RiskAssessment,
} from '@/lib/risk-scoring';

const DAY_MS = 24 * 60 * 60 * 1000;

export type LiveStudentRiskContext = {
  studentId: string;
  studentName: string;
  assignmentId: number;
  assignmentTitle: string;
  checkpoints: CheckpointRiskData[];
  assessment: RiskAssessment;
};

export type LiveStudentRiskOptions = {
  assignmentIds: number[];
  studentId?: string;
  now?: Date;
};

/**
 * Build live risk contexts from current checkpoint, submission, review, and
 * consultation data. Risk semantics remain owned by computeStudentRisk.
 */
export async function getLiveStudentRiskContexts(
  db: Db,
  options: LiveStudentRiskOptions,
): Promise<LiveStudentRiskContext[]> {
  if (options.assignmentIds.length === 0) return [];

  const now = options.now ?? new Date();
  const checkpointFilters = [
    inArray(checkpoints.assignmentId, options.assignmentIds),
    sql`${checkpoints.state} IN ('unlocked', 'revise', 'under_review', 'submitted')`,
  ];
  if (options.studentId) checkpointFilters.push(eq(checkpoints.studentId, options.studentId));

  const atRiskCheckpoints = await db
    .select({
      checkpointId: checkpoints.id,
      checkpointState: checkpoints.state,
      dueDate: checkpoints.dueDate,
      minConsultations: checkpoints.minConsultations,
      studentId: checkpoints.studentId,
      studentName: users.name,
      assignmentId: assignments.id,
      assignmentTitle: assignments.title,
    })
    .from(checkpoints)
    .innerJoin(assignments, eq(checkpoints.assignmentId, assignments.id))
    .innerJoin(users, eq(checkpoints.studentId, users.id))
    .where(and(...checkpointFilters));

  if (atRiskCheckpoints.length === 0) return [];

  const checkpointIds = atRiskCheckpoints.map((checkpoint) => checkpoint.checkpointId);
  const [consultationCounts, submissionData, reviseCounts] = await Promise.all([
    db
      .select({
        checkpointId: consultations.checkpointId,
        count: sql<number>`count(*)::int`,
      })
      .from(consultations)
      .where(
        and(
          inArray(consultations.checkpointId, checkpointIds),
          eq(consultations.status, 'verified'),
        ),
      )
      .groupBy(consultations.checkpointId),
    db
      .select({
        checkpointId: submissions.checkpointId,
        count: sql<number>`count(*)::int`,
        latestDate: sql<Date>`max(${submissions.uploadedAt})`,
      })
      .from(submissions)
      .where(inArray(submissions.checkpointId, checkpointIds))
      .groupBy(submissions.checkpointId),
    db
      .select({
        checkpointId: submissions.checkpointId,
        count: sql<number>`count(*)::int`,
      })
      .from(reviews)
      .innerJoin(submissions, eq(reviews.submissionId, submissions.id))
      .where(and(inArray(submissions.checkpointId, checkpointIds), eq(reviews.decision, 'revise')))
      .groupBy(submissions.checkpointId),
  ]);

  const consultationMap = new Map(
    consultationCounts.map((item) => [item.checkpointId, item.count]),
  );
  const submissionMap = new Map(
    submissionData.map((item) => [
      item.checkpointId,
      { count: item.count, latestDate: item.latestDate },
    ]),
  );
  const reviseMap = new Map(reviseCounts.map((item) => [item.checkpointId, item.count]));

  const studentAssignmentGroups = new Map<string, LiveStudentRiskContext['checkpoints']>();
  const groupMetadata = new Map<
    string,
    Pick<LiveStudentRiskContext, 'studentId' | 'studentName' | 'assignmentId' | 'assignmentTitle'>
  >();

  for (const checkpoint of atRiskCheckpoints) {
    const key = `${checkpoint.studentId}:${checkpoint.assignmentId}`;
    if (!studentAssignmentGroups.has(key)) {
      studentAssignmentGroups.set(key, []);
      groupMetadata.set(key, {
        studentId: checkpoint.studentId,
        studentName: checkpoint.studentName,
        assignmentId: checkpoint.assignmentId,
        assignmentTitle: checkpoint.assignmentTitle,
      });
    }

    const submissionInfo = submissionMap.get(checkpoint.checkpointId);
    const underReviewWaitDays =
      checkpoint.checkpointState === 'under_review' && submissionInfo?.latestDate
        ? Math.floor((now.getTime() - submissionInfo.latestDate.getTime()) / DAY_MS)
        : null;

    studentAssignmentGroups.get(key)!.push({
      checkpointId: checkpoint.checkpointId,
      state: checkpoint.checkpointState,
      dueDate: checkpoint.dueDate ?? new Date(now.getTime() + 365 * DAY_MS),
      minConsultations: checkpoint.minConsultations ?? 0,
      verifiedConsultationCount: consultationMap.get(checkpoint.checkpointId) ?? 0,
      submissionCount: submissionInfo?.count ?? 0,
      latestSubmissionDate: submissionInfo?.latestDate ?? null,
      reviseCount: reviseMap.get(checkpoint.checkpointId) ?? 0,
      underReviewWaitDays,
    });
  }

  return Array.from(studentAssignmentGroups, ([key, riskCheckpoints]) => {
    const metadata = groupMetadata.get(key)!;
    return {
      ...metadata,
      checkpoints: riskCheckpoints,
      assessment: computeStudentRisk({
        studentId: metadata.studentId,
        now,
        checkpoints: riskCheckpoints,
      }),
    };
  });
}
