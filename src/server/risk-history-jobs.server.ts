import { and, asc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import { getDb, type Db } from '@/db';
import { academicTerms } from '@/db/schema/academic-context';
import { assignments, assignmentStudents } from '@/db/schema/assignments';
import { riskObservations } from '@/db/schema/risk-observations';
import { safeAuditLog } from '@/lib/audit';
import { recordRiskObservation } from '@/server/risk-observation-recorder.server';

const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 500;
const DAILY_ACTOR_ID = 'system:risk-history-daily';
const RETENTION_ACTOR_ID = 'system:risk-history-retention';

type JobOptions = {
  db?: Db;
  now?: Date;
  batchSize?: number;
};

function boundedBatchSize(value = DEFAULT_BATCH_SIZE) {
  return Math.max(1, Math.min(MAX_BATCH_SIZE, Math.floor(value)));
}

function utcDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function fiveYearCutoff(now: Date) {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 5);
  return utcDate(cutoff);
}

export async function processDailyRiskSnapshots(options: JobOptions = {}) {
  const db = options.db ?? getDb();
  const now = options.now ?? new Date();
  const batchSize = boundedBatchSize(options.batchSize);
  const candidates = await db
    .select({
      assignmentId: assignmentStudents.assignmentId,
      studentId: assignmentStudents.studentId,
    })
    .from(assignmentStudents)
    .innerJoin(assignments, eq(assignmentStudents.assignmentId, assignments.id))
    .leftJoin(
      riskObservations,
      eq(
        riskObservations.idempotencyKey,
        sql`${`risk-observation:daily:${utcDate(now)}:`} || ${assignmentStudents.assignmentId} || ':' || ${assignmentStudents.studentId}`,
      ),
    )
    .where(
      and(
        eq(assignments.status, 'active'),
        isNull(assignments.deletedAt),
        isNull(riskObservations.id),
      ),
    )
    .orderBy(asc(assignmentStudents.assignmentId), asc(assignmentStudents.studentId))
    .limit(batchSize);

  let created = 0;
  const date = utcDate(now);
  for (const candidate of candidates) {
    const result = await recordRiskObservation(db, {
      source: 'daily_snapshot',
      idempotencyKey: `risk-observation:daily:${date}:${candidate.assignmentId}:${candidate.studentId}`,
      assignmentId: candidate.assignmentId,
      studentId: candidate.studentId,
      actorId: DAILY_ACTOR_ID,
      observedAt: now,
    });
    if (result.created) created += 1;
  }

  return { scanned: candidates.length, created, hasMore: candidates.length === batchSize };
}

export async function processRiskObservationRetention(options: JobOptions = {}) {
  const db = options.db ?? getDb();
  const now = options.now ?? new Date();
  const batchSize = boundedBatchSize(options.batchSize);
  const expired = await db
    .select({ id: riskObservations.id })
    .from(riskObservations)
    .innerJoin(academicTerms, eq(riskObservations.academicTermId, academicTerms.id))
    .where(
      and(
        eq(riskObservations.retentionState, 'identifiable'),
        lt(academicTerms.endDate, fiveYearCutoff(now)),
      ),
    )
    .orderBy(asc(riskObservations.id))
    .limit(batchSize);

  if (expired.length === 0) return { scanned: 0, anonymized: 0, hasMore: false };

  const ids = expired.map((row) => row.id);
  const result = (await db
    .update(riskObservations)
    .set({
      assignmentId: null,
      studentId: null,
      checkpointId: null,
      interventionId: null,
      sourceEventId: null,
      idempotencyKey: sql`'risk-observation:anonymized:' || ${riskObservations.id}`,
      factorSnapshot: [],
      explanationSnapshot: { version: 'risk-observation-anonymized-v1' },
      retentionState: 'anonymized',
      anonymizedAt: now,
    })
    .where(
      and(inArray(riskObservations.id, ids), eq(riskObservations.retentionState, 'identifiable')),
    )) as { rowCount?: number };
  const anonymized = result.rowCount ?? ids.length;

  await safeAuditLog('risk_observation.retention_anonymized', {
    actorId: RETENTION_ACTOR_ID,
    action: 'risk_observation.retention_anonymized',
    entityType: 'risk_observation_batch',
    entityId: utcDate(now),
    details: { anonymizedCount: anonymized },
  });

  return { scanned: expired.length, anonymized, hasMore: expired.length === batchSize };
}

export async function processRiskHistoryJobs(options: JobOptions = {}) {
  const snapshots = await processDailyRiskSnapshots(options);
  const retention = await processRiskObservationRetention(options);
  return { snapshots, retention, complete: !snapshots.hasMore && !retention.hasMore };
}
