/**
 * At-risk student alert dispatch.
 *
 * Fetches student checkpoint data, computes risk, checks 7-day dedup,
 * and fires in-app notification + email to the instructor.
 * Advisory only — never throws.
 */
import { eq, and, inArray, gt, sql } from 'drizzle-orm';
import { checkpoints } from '../db/schema/assignments';
import { consultations } from '../db/schema/consultations';
import { submissions, reviews } from '../db/schema/submissions';
import { notifications } from '../db/schema/notifications';
import { computeStudentRisk } from './risk-scoring';
import type { CheckpointRiskData } from './risk-scoring';
import { sendStudentAtRiskEmail } from './at-risk-email';
import { getNotificationKeys } from './i18n-server';
import type { Db } from '../db/index';

export interface RiskAlertOpts {
  studentId: string;
  studentName: string;
  assignmentId: number;
  assignmentTitle: string;
  instructorId: string;
}

/**
 * Fetches student checkpoint data, computes risk, checks 7-day dedup,
 * and fires in-app notification + email to the instructor.
 * Advisory only — failures are logged but do not propagate.
 */
export async function checkAndFireRiskAlert(db: Db, opts: RiskAlertOpts): Promise<void> {
  try {
    // 1. Fetch checkpoints for this student+assignment in active states
    const studentCheckpoints = await db
      .select({
        checkpointId: checkpoints.id,
        state: checkpoints.state,
        dueDate: checkpoints.dueDate,
        minConsultations: checkpoints.minConsultations,
        order: checkpoints.order,
      })
      .from(checkpoints)
      .where(
        and(
          eq(checkpoints.assignmentId, opts.assignmentId),
          eq(checkpoints.studentId, opts.studentId),
          inArray(checkpoints.state, ['unlocked', 'revise', 'under_review', 'submitted']),
        ),
      );

    if (studentCheckpoints.length === 0) return;

    const checkpointIds = studentCheckpoints.map((cp) => cp.checkpointId);

    // 2. Fetch aggregates in parallel
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
            eq(consultations.studentId, opts.studentId),
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
        .where(
          and(inArray(submissions.checkpointId, checkpointIds), eq(reviews.decision, 'revise')),
        )
        .groupBy(submissions.checkpointId),
    ]);

    // 3. Build lookup maps
    const consultMap = new Map(consultationCounts.map((c) => [c.checkpointId, c.count]));
    const subMap = new Map(
      submissionData.map((s) => [s.checkpointId, { count: s.count, latestDate: s.latestDate }]),
    );
    const reviseMap = new Map(reviseCounts.map((r) => [r.checkpointId, r.count]));

    // 4. Build CheckpointRiskData[] and compute risk
    const now = new Date();
    const checkpointData: CheckpointRiskData[] = studentCheckpoints.map((cp) => {
      const subInfo = subMap.get(cp.checkpointId);
      const underReviewWaitDays =
        cp.state === 'under_review' && subInfo?.latestDate
          ? Math.floor((now.getTime() - subInfo.latestDate.getTime()) / (24 * 60 * 60 * 1000))
          : null;

      return {
        checkpointId: cp.checkpointId,
        state: cp.state,
        dueDate: cp.dueDate ?? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
        minConsultations: cp.minConsultations ?? 0,
        verifiedConsultationCount: consultMap.get(cp.checkpointId) ?? 0,
        submissionCount: subInfo?.count ?? 0,
        latestSubmissionDate: subInfo?.latestDate ?? null,
        reviseCount: reviseMap.get(cp.checkpointId) ?? 0,
        underReviewWaitDays,
      };
    });

    const assessment = computeStudentRisk({
      studentId: opts.studentId,
      now,
      checkpoints: checkpointData,
    });

    // 5. Skip if low (only fire for medium or high)
    if (assessment.level === 'low') return;

    // 6. Check 7-day dedup
    const existingAlerts = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.type, 'student_at_risk'),
          eq(notifications.userId, opts.instructorId),
          sql`${notifications.metadata}->>'studentId' = ${opts.studentId}`,
          sql`${notifications.metadata}->>'assignmentId' = ${String(opts.assignmentId)}`,
          gt(notifications.createdAt, sql`NOW() - INTERVAL '7 days'`),
        ),
      );

    if (existingAlerts.length > 0) return;

    // 7. Fire in-app notification + email via Promise.allSettled
    const riskKeys = getNotificationKeys('student_at_risk');
    const riskParams = {
      studentName: opts.studentName,
      assignmentTitle: opts.assignmentTitle,
      riskLevel: assessment.level,
      riskFactors: assessment.factors.map((f) => f.description).join(', '),
    };

    await Promise.allSettled([
      db.insert(notifications).values({
        userId: opts.instructorId,
        type: 'student_at_risk',
        titleKey: riskKeys.titleKey,
        messageKey: riskKeys.messageKey,
        params: riskParams,
        channel: 'in_app',
        metadata: {
          assignmentId: opts.assignmentId,
          studentId: opts.studentId,
          riskLevel: assessment.level,
          factors: assessment.factors,
        },
      }),
      sendStudentAtRiskEmail({
        recipientId: opts.instructorId,
        studentName: opts.studentName,
        assignmentTitle: opts.assignmentTitle,
        assignmentId: opts.assignmentId,
        riskLevel: assessment.level,
        riskFactors: riskParams.riskFactors,
      }),
    ]);
  } catch (err) {
    console.error('Failed to fire risk alert:', err);
  }
}
