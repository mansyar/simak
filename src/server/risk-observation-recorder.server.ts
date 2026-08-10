import { eq } from 'drizzle-orm';
import type { Db } from '@/db';
import { courseSections } from '@/db/schema/academic-context';
import { assignments } from '@/db/schema/assignments';
import { riskObservations } from '@/db/schema/risk-observations';
import { safeAuditLog } from '@/lib/audit';
import { RISK_ALGORITHM_VERSION } from '@/lib/risk-scoring';
import { getLiveStudentRiskContexts } from '@/server/student-risk-context.server';

type LifecycleEventType =
  | 'checkpoint_updated'
  | 'submission_recorded'
  | 'review_recorded'
  | 'consultation_verified'
  | 'intervention_updated';

type BaseObservationInput = {
  assignmentId: number;
  studentId: string;
  checkpointId?: number | null;
  interventionId?: number | null;
  actorId: string;
  observedAt?: Date;
};

type LifecycleObservationInput = BaseObservationInput & {
  source: 'lifecycle_event';
  eventType: LifecycleEventType;
  sourceEventId: string;
};

type DailySnapshotInput = BaseObservationInput & {
  source: 'daily_snapshot';
  idempotencyKey: string;
};

export type RecordRiskObservationInput = LifecycleObservationInput | DailySnapshotInput;

function observationIdempotencyKey(input: RecordRiskObservationInput) {
  if (input.source === 'daily_snapshot') return input.idempotencyKey;

  return `risk-observation:${input.eventType}:${input.sourceEventId}:${input.assignmentId}:${input.studentId}`;
}

/**
 * Appends a privacy-minimized, explainable snapshot of a student's live risk.
 * The assessment itself remains exclusively owned by computeStudentRisk.
 */
export async function recordRiskObservation(db: Db, input: RecordRiskObservationInput) {
  const observedAt = input.observedAt ?? new Date();
  const [academicContext] = await db
    .select({
      sectionId: courseSections.id,
      courseId: courseSections.courseId,
      academicTermId: courseSections.termId,
    })
    .from(assignments)
    .innerJoin(courseSections, eq(assignments.sectionId, courseSections.id))
    .where(eq(assignments.id, input.assignmentId))
    .limit(1);

  if (!academicContext) {
    throw new Error('Risk observation assignment context not found');
  }

  const [liveContext] = await getLiveStudentRiskContexts(db, {
    assignmentIds: [input.assignmentId],
    studentId: input.studentId,
    now: observedAt,
  });
  const assessment = liveContext?.assessment ?? { level: 'low' as const, factors: [] };
  const factorSnapshot = assessment.factors
    .map((factor) => ({ code: factor.type, category: factor.category, severity: factor.severity }))
    .sort(
      (left, right) =>
        left.code.localeCompare(right.code) ||
        left.category.localeCompare(right.category) ||
        left.severity.localeCompare(right.severity),
    );
  const [observation] = await db
    .insert(riskObservations)
    .values({
      source: input.source,
      eventType: input.source === 'lifecycle_event' ? input.eventType : null,
      sourceEventId: input.source === 'lifecycle_event' ? input.sourceEventId : null,
      idempotencyKey: observationIdempotencyKey(input),
      assignmentId: input.assignmentId,
      studentId: input.studentId,
      checkpointId: input.checkpointId ?? null,
      interventionId: input.interventionId ?? null,
      sectionId: academicContext.sectionId,
      courseId: academicContext.courseId,
      academicTermId: academicContext.academicTermId,
      observedAt,
      algorithmVersion: RISK_ALGORITHM_VERSION,
      riskLevel: assessment.level,
      factorSnapshot,
      explanationSnapshot: {
        version: 'risk-observation-explanation-v1',
        factorCodes: factorSnapshot.map((factor) => factor.code),
      },
    })
    .onConflictDoNothing({ target: riskObservations.idempotencyKey })
    .returning({ id: riskObservations.id });

  if (!observation) return { created: false };

  await safeAuditLog('risk_observation.recorded', {
    actorId: input.actorId,
    action: 'risk_observation.recorded',
    entityType: 'risk_observation',
    entityId: String(observation.id),
    details: {
      assignmentId: input.assignmentId,
      studentId: input.studentId,
      source: input.source,
      eventType: input.source === 'lifecycle_event' ? input.eventType : null,
    },
  });

  return { created: true, observationId: observation.id };
}
