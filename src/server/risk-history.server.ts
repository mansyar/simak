import type {
  GetAdminRiskTrendsSchema,
  GetStudentSupportStatusSchema,
  ListInstructorRiskHistorySchema,
} from './risk-history';
import type { z } from 'zod';
import { and, asc, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { assignments, assignmentStudents, checkpoints } from '@/db/schema/assignments';
import { consultations } from '@/db/schema/consultations';
import { interventions } from '@/db/schema/interventions';
import { riskObservations } from '@/db/schema/risk-observations';
import { reviews, submissions } from '@/db/schema/submissions';
import { safeAuditLog } from '@/lib/audit';
import { ErrorCode, serverError } from '@/lib/errors';
import { isAdmin, isInstructor } from '@/lib/session-guards';
import { getSessionFromHeaders } from '@/server/auth';

type InstructorHistoryInput = z.infer<typeof ListInstructorRiskHistorySchema>;
type AdminTrendsInput = z.infer<typeof GetAdminRiskTrendsSchema>;
type StudentSupportInput = z.infer<typeof GetStudentSupportStatusSchema>;

function dateConditions(column: Parameters<typeof gte>[0], from: Date | null, to: Date | null) {
  return and(from ? gte(column, from) : undefined, to ? lte(column, to) : undefined);
}

export async function listInstructorRiskHistoryHandler({ data }: { data: InstructorHistoryInput }) {
  const session = await getSessionFromHeaders();
  if (!isInstructor(session)) return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');

  const db = getDb();
  const [ownedStudent] = await db
    .select({ id: assignments.id })
    .from(assignments)
    .innerJoin(
      assignmentStudents,
      and(
        eq(assignmentStudents.assignmentId, assignments.id),
        eq(assignmentStudents.studentId, data.studentId),
      ),
    )
    .where(
      and(
        eq(assignments.id, data.assignmentId),
        eq(assignments.instructorId, session.user.id),
        isNull(assignments.deletedAt),
      ),
    )
    .limit(1);

  if (!ownedStudent) {
    await safeAuditLog('risk_history.instructor_denied', {
      actorId: session.user.id,
      action: 'risk_history.instructor_denied',
      entityType: 'assignment',
      entityId: String(data.assignmentId),
      details: { assignmentId: data.assignmentId, studentId: data.studentId },
    });
    return serverError(ErrorCode.NOT_FOUND, 'Assignment or student not found');
  }

  const scope = and(
    eq(riskObservations.assignmentId, data.assignmentId),
    eq(riskObservations.studentId, data.studentId),
    eq(riskObservations.retentionState, 'identifiable'),
    dateConditions(riskObservations.observedAt, data.from, data.to),
  );
  const offset = (data.page - 1) * data.limit;
  const [
    observations,
    [historyCount],
    [checkpointFacts],
    [reviewFacts],
    [consultationFacts],
    basis,
  ] = await Promise.all([
    db
      .select({
        id: riskObservations.id,
        source: riskObservations.source,
        eventType: riskObservations.eventType,
        observedAt: riskObservations.observedAt,
        algorithmVersion: riskObservations.algorithmVersion,
        riskLevel: riskObservations.riskLevel,
        factors: riskObservations.factorSnapshot,
        explanationSnapshot: riskObservations.explanationSnapshot,
        checkpointId: riskObservations.checkpointId,
        interventionId: riskObservations.interventionId,
      })
      .from(riskObservations)
      .where(scope)
      .orderBy(desc(riskObservations.observedAt), desc(riskObservations.id))
      .limit(data.limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(riskObservations)
      .where(scope),
    db
      .select({
        total: sql<number>`count(*)::int`,
        passed: sql<number>`count(*) filter (where ${checkpoints.state} = 'passed')::int`,
      })
      .from(checkpoints)
      .where(
        and(
          eq(checkpoints.assignmentId, data.assignmentId),
          eq(checkpoints.studentId, data.studentId),
          dateConditions(checkpoints.updatedAt, data.from, data.to),
        ),
      ),
    db
      .select({
        submissions: sql<number>`count(distinct ${submissions.id})::int`,
        reviews: sql<number>`count(distinct ${reviews.id})::int`,
      })
      .from(checkpoints)
      .innerJoin(submissions, eq(submissions.checkpointId, checkpoints.id))
      .leftJoin(reviews, eq(reviews.submissionId, submissions.id))
      .where(
        and(
          eq(checkpoints.assignmentId, data.assignmentId),
          eq(checkpoints.studentId, data.studentId),
          dateConditions(submissions.uploadedAt, data.from, data.to),
        ),
      ),
    db
      .select({ verified: sql<number>`count(*)::int` })
      .from(consultations)
      .where(
        and(
          eq(consultations.assignmentId, data.assignmentId),
          eq(consultations.studentId, data.studentId),
          eq(consultations.status, 'verified'),
          dateConditions(consultations.verifiedAt, data.from, data.to),
        ),
      ),
    db
      .select({
        id: interventions.id,
        actionType: interventions.actionType,
        status: interventions.status,
        followUpDate: interventions.followUpDate,
        createdAt: interventions.createdAt,
        updatedAt: interventions.updatedAt,
      })
      .from(interventions)
      .where(
        and(
          eq(interventions.assignmentId, data.assignmentId),
          eq(interventions.studentId, data.studentId),
          dateConditions(interventions.createdAt, data.from, data.to),
        ),
      )
      .orderBy(asc(interventions.createdAt), asc(interventions.id)),
  ]);

  const checkpointTotal = checkpointFacts?.total ?? 0;
  const checkpointPassed = checkpointFacts?.passed ?? 0;
  const verifiedConsultationCount = consultationFacts?.verified ?? 0;
  const academicProgress =
    checkpointTotal > 0 && checkpointPassed === checkpointTotal
      ? 'complete'
      : checkpointPassed > 0
        ? 'in_progress'
        : 'not_started';
  const engagement =
    verifiedConsultationCount > 0 || basis.some((item) => item.status !== 'dismissed')
      ? 'engaged'
      : 'no_recorded_engagement';

  await safeAuditLog('risk_history.instructor_viewed', {
    actorId: session.user.id,
    action: 'risk_history.instructor_viewed',
    entityType: 'assignment',
    entityId: String(data.assignmentId),
    details: { assignmentId: data.assignmentId, studentId: data.studentId },
  });

  return {
    observations,
    total: historyCount?.count ?? 0,
    page: data.page,
    limit: data.limit,
    outcomes: {
      facts: {
        checkpointTotal,
        checkpointPassed,
        submissionCount: reviewFacts?.submissions ?? 0,
        reviewCount: reviewFacts?.reviews ?? 0,
        verifiedConsultationCount,
      },
      interpretation: { academicProgress, engagement },
      interventionBasis: basis,
    },
  };
}

export async function getAdminRiskTrendsHandler({ data }: { data: AdminTrendsInput }) {
  const session = await getSessionFromHeaders();
  if (!isAdmin(session)) return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');

  const db = getDb();
  const contextScope = and(
    data.termId ? eq(riskObservations.academicTermId, data.termId) : undefined,
    data.courseId ? eq(riskObservations.courseId, data.courseId) : undefined,
    data.sectionId ? eq(riskObservations.sectionId, data.sectionId) : undefined,
    dateConditions(riskObservations.observedAt, data.from, data.to),
  );
  const [cohort] = await db
    .select({ cohortSize: sql<number>`count(distinct ${riskObservations.studentId})::int` })
    .from(riskObservations)
    .where(and(contextScope, eq(riskObservations.retentionState, 'identifiable')));

  const cohortSize = cohort?.cohortSize ?? 0;
  const suppressed = cohortSize < 10;
  const trends = suppressed
    ? []
    : await db
        .select({
          date: sql<string>`date(${riskObservations.observedAt})::text`,
          riskLevel: riskObservations.riskLevel,
          observationCount: sql<number>`count(*)::int`,
        })
        .from(riskObservations)
        .where(contextScope)
        .groupBy(sql`date(${riskObservations.observedAt})`, riskObservations.riskLevel)
        .orderBy(asc(sql`date(${riskObservations.observedAt})`), asc(riskObservations.riskLevel))
        .limit(1000);

  await safeAuditLog('risk_history.admin_aggregate_viewed', {
    actorId: session.user.id,
    action: 'risk_history.admin_aggregate_viewed',
    entityType: 'academic_context',
    entityId: String(data.sectionId ?? data.courseId ?? data.termId),
    details: {
      termId: data.termId,
      courseId: data.courseId,
      sectionId: data.sectionId,
      suppressed,
    },
  });

  return { suppressed, minimumCohortSize: 10, cohortSize, trends };
}

export async function getStudentSupportStatusHandler(_: { data: StudentSupportInput }) {
  throw new Error('Risk-history queries are not implemented yet');
}
