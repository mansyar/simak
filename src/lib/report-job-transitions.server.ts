import { and, eq, lte, sql } from 'drizzle-orm';
import { getDb, type Db } from '@/db/index';
import { reportJobs } from '@/db/schema/report-jobs';
import { calculateReportExpiry } from '@/lib/reporting-policy';

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

function first(rows: ReportJob[]): ReportJob | null {
  return rows[0] ?? null;
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
    !artifact.artifactSha256.trim()
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
    .set({ state: 'expired', artifactKey: null, updatedAt: now })
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
