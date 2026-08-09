import { and, asc, eq, isNotNull, lte, sql } from 'drizzle-orm';
import { getDb, type Db } from '@/db/index';
import { reportJobs } from '@/db/schema/report-jobs';
import { calculateReportExpiry } from '@/lib/reporting-policy';

export const REPORT_STALE_PROCESSING_TIMEOUT_MS = 10 * 60 * 1000;
export const REPORT_STALE_FAILURE_CODE = 'generation_timeout';
export const REPORT_STALE_FAILURE_MESSAGE = 'Report generation timed out';

const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

type ReportJob = typeof reportJobs.$inferSelect;

interface TransitionOptions {
  db?: Db;
  now?: Date;
}

interface ReportArtifact {
  artifactKey: string;
  artifactSizeBytes: number;
  artifactSha256: string;
}

interface ReportFailure {
  code: string;
  message: string;
}

function context(options: TransitionOptions): { db: Db; now: Date } {
  return { db: options.db ?? getDb(), now: options.now ?? new Date() };
}

function validateJobId(jobId: number): void {
  if (!Number.isInteger(jobId) || jobId <= 0) throw new Error('Invalid report job ID');
}

function validateBatchLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit <= 0) throw new Error('Invalid batch limit');
}

function first(rows: ReportJob[]): ReportJob | null {
  return rows[0] ?? null;
}

export async function selectDueCompletedJobs(
  limit: number,
  options: TransitionOptions = {},
): Promise<ReportJob[]> {
  validateBatchLimit(limit);
  const { db, now } = context(options);
  return db
    .select()
    .from(reportJobs)
    .where(
      and(
        eq(reportJobs.state, 'completed'),
        lte(reportJobs.expiresAt, now),
        isNotNull(reportJobs.artifactKey),
      ),
    )
    .orderBy(asc(reportJobs.expiresAt))
    .limit(limit);
}

export async function selectStaleExpiredJobs(
  limit: number,
  options: TransitionOptions = {},
): Promise<ReportJob[]> {
  validateBatchLimit(limit);
  const { db } = context(options);
  return db
    .select()
    .from(reportJobs)
    .where(
      and(
        eq(reportJobs.state, 'expired'),
        isNotNull(reportJobs.artifactKey),
        isNotNull(reportJobs.artifactSizeBytes),
        isNotNull(reportJobs.artifactSha256),
      ),
    )
    .orderBy(asc(reportJobs.updatedAt))
    .limit(limit);
}

export async function selectStaleProcessingJobs(
  limit: number,
  options: TransitionOptions = {},
): Promise<ReportJob[]> {
  validateBatchLimit(limit);
  const { db, now } = context(options);
  return db
    .select()
    .from(reportJobs)
    .where(
      and(
        eq(reportJobs.state, 'processing'),
        lte(reportJobs.startedAt, new Date(now.getTime() - REPORT_STALE_PROCESSING_TIMEOUT_MS)),
      ),
    )
    .orderBy(asc(reportJobs.startedAt))
    .limit(limit);
}

export async function startReportJob(
  jobId: number,
  options: TransitionOptions = {},
): Promise<ReportJob | null> {
  validateJobId(jobId);
  const { db, now } = context(options);
  const rows = await db
    .update(reportJobs)
    .set({
      state: 'processing',
      attempts: sql`${reportJobs.attempts} + 1`,
      startedAt: now,
      updatedAt: now,
    })
    .where(and(eq(reportJobs.id, jobId), eq(reportJobs.state, 'pending')))
    .returning();
  return first(rows);
}

export async function failStaleProcessingJob(
  jobId: number,
  options: TransitionOptions = {},
): Promise<ReportJob | null> {
  validateJobId(jobId);
  const { db, now } = context(options);
  const rows = await db
    .update(reportJobs)
    .set({
      state: 'failed',
      failureCode: REPORT_STALE_FAILURE_CODE,
      failureMessage: REPORT_STALE_FAILURE_MESSAGE,
      failedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(reportJobs.id, jobId),
        eq(reportJobs.state, 'processing'),
        lte(reportJobs.startedAt, new Date(now.getTime() - REPORT_STALE_PROCESSING_TIMEOUT_MS)),
      ),
    )
    .returning();
  return first(rows);
}

export async function completeReportJob(
  jobId: number,
  artifact: ReportArtifact,
  options: TransitionOptions = {},
): Promise<ReportJob | null> {
  validateJobId(jobId);
  if (
    !artifact.artifactKey.trim() ||
    !Number.isInteger(artifact.artifactSizeBytes) ||
    artifact.artifactSizeBytes <= 0 ||
    !SHA256_HEX_PATTERN.test(artifact.artifactSha256)
  ) {
    throw new Error('Invalid report artifact metadata');
  }
  const { db, now } = context(options);
  const rows = await db
    .update(reportJobs)
    .set({
      state: 'completed',
      artifactKey: artifact.artifactKey,
      artifactSizeBytes: artifact.artifactSizeBytes,
      artifactSha256: artifact.artifactSha256,
      completedAt: now,
      expiresAt: calculateReportExpiry(now),
      updatedAt: now,
    })
    .where(and(eq(reportJobs.id, jobId), eq(reportJobs.state, 'processing')))
    .returning();
  return first(rows);
}

export async function failReportJob(
  jobId: number,
  failure: ReportFailure,
  options: TransitionOptions = {},
): Promise<ReportJob | null> {
  validateJobId(jobId);
  if (!failure.code.trim() || !failure.message.trim()) throw new Error('Invalid report failure');
  const { db, now } = context(options);
  const rows = await db
    .update(reportJobs)
    .set({
      state: 'failed',
      failureCode: failure.code,
      failureMessage: failure.message,
      failedAt: now,
      updatedAt: now,
    })
    .where(and(eq(reportJobs.id, jobId), eq(reportJobs.state, 'processing')))
    .returning();
  return first(rows);
}

export async function retryReportJob(
  jobId: number,
  options: TransitionOptions = {},
): Promise<ReportJob | null> {
  validateJobId(jobId);
  const { db, now } = context(options);
  const rows = await db
    .update(reportJobs)
    .set({
      state: 'pending',
      startedAt: null,
      failedAt: null,
      failureCode: null,
      failureMessage: null,
      updatedAt: now,
    })
    .where(and(eq(reportJobs.id, jobId), eq(reportJobs.state, 'failed')))
    .returning();
  return first(rows);
}

export async function expireReportJob(
  jobId: number,
  options: TransitionOptions = {},
): Promise<ReportJob | null> {
  validateJobId(jobId);
  const { db, now } = context(options);
  const rows = await db
    .update(reportJobs)
    .set({ state: 'expired', updatedAt: now })
    .where(
      and(
        eq(reportJobs.id, jobId),
        eq(reportJobs.state, 'completed'),
        lte(reportJobs.expiresAt, now),
      ),
    )
    .returning();
  return first(rows);
}

export async function finalizeExpiredReportJob(
  jobId: number,
  options: TransitionOptions = {},
): Promise<ReportJob | null> {
  validateJobId(jobId);
  const { db, now } = context(options);
  const rows = await db
    .update(reportJobs)
    .set({
      artifactKey: null,
      artifactSizeBytes: null,
      artifactSha256: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(reportJobs.id, jobId),
        eq(reportJobs.state, 'expired'),
        isNotNull(reportJobs.artifactKey),
      ),
    )
    .returning();
  return first(rows);
}
