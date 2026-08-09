import { safeAuditLog } from '@/lib/audit';
import { ErrorCode, serverError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import {
  expireReportJob,
  finalizeExpiredReportJob,
  selectDueCompletedJobs,
  selectStaleExpiredJobs,
} from '@/lib/report-job-transitions.server';
import { type Session, getSessionFromHeaders } from './auth';
import { deleteReportArtifact } from './report-storage.server';

type ReportJob = Awaited<ReturnType<typeof selectDueCompletedJobs>>[number];
type AuditEvent = Parameters<typeof safeAuditLog>[1];
type SafeLogger = Pick<typeof logger, 'info' | 'error'>;

export const DEFAULT_EXPIRY_BATCH_SIZE = 50;

export interface ExpiryCleanupDependencies {
  getSession: () => Promise<Session | null>;
  selectDueCompleted: (limit: number) => Promise<ReportJob[]>;
  selectStaleExpired: (limit: number) => Promise<ReportJob[]>;
  expireJob: (jobId: number) => Promise<ReportJob | null>;
  deleteArtifact: (artifactKey: string) => Promise<'deleted' | 'not_found'>;
  finalizeJob: (jobId: number) => Promise<ReportJob | null>;
  audit: (event: AuditEvent) => Promise<void>;
  log: SafeLogger;
}

export interface ExpiryCleanupSummary {
  dueCompleted: number;
  staleExpired: number;
  expired: number;
  finalized: number;
  failedDeletions: number;
}

const defaultExpiryCleanupDependencies: ExpiryCleanupDependencies = {
  getSession: getSessionFromHeaders,
  selectDueCompleted: (limit: number) => selectDueCompletedJobs(limit),
  selectStaleExpired: (limit: number) => selectStaleExpiredJobs(limit),
  expireJob: expireReportJob,
  deleteArtifact: deleteReportArtifact,
  finalizeJob: finalizeExpiredReportJob,
  audit: (event) => safeAuditLog(event.action, event),
  log: logger,
};

async function deleteAndFinalize(
  job: ReportJob,
  actorId: string,
  dependencies: ExpiryCleanupDependencies,
  summary: ExpiryCleanupSummary,
): Promise<void> {
  if (!job.artifactKey) return;
  try {
    await dependencies.deleteArtifact(job.artifactKey);
  } catch {
    summary.failedDeletions += 1;
    await dependencies.audit({
      actorId,
      action: 'report_expiry_cleanup_failed',
      entityType: 'report_job',
      entityId: String(job.id),
      details: { reportType: job.reportType },
    });
    dependencies.log.error({
      event: 'report_expiry_cleanup_failed',
      reportJobId: job.id,
      reportType: job.reportType,
    });
    return;
  }
  const finalized = await dependencies.finalizeJob(job.id);
  if (finalized) summary.finalized += 1;
}

export async function runReportExpiryCleanup(
  batchSize: number,
  actorId: string,
  dependencies: ExpiryCleanupDependencies,
): Promise<ExpiryCleanupSummary> {
  const summary: ExpiryCleanupSummary = {
    dueCompleted: 0,
    staleExpired: 0,
    expired: 0,
    finalized: 0,
    failedDeletions: 0,
  };

  const stale = await dependencies.selectStaleExpired(batchSize);
  summary.staleExpired = stale.length;
  for (const job of stale) {
    await deleteAndFinalize(job, actorId, dependencies, summary);
  }

  const due = await dependencies.selectDueCompleted(batchSize);
  summary.dueCompleted = due.length;
  for (const job of due) {
    const expired = await dependencies.expireJob(job.id);
    if (!expired) continue;
    summary.expired += 1;
    await dependencies.audit({
      actorId,
      action: 'report_expired',
      entityType: 'report_job',
      entityId: String(job.id),
      details: { reportType: job.reportType },
    });
    await deleteAndFinalize(expired, actorId, dependencies, summary);
  }

  await dependencies.audit({
    actorId,
    action: 'report_expiry_cleanup',
    entityType: 'report_expiry_cleanup',
    entityId: 'batch',
    details: { ...summary },
  });
  dependencies.log.info({ event: 'report_expiry_cleanup', ...summary });
  return summary;
}

export async function runReportExpiryCleanupHandler(
  args: { data: { batchSize?: number } },
  overrides?: ExpiryCleanupDependencies,
) {
  const dependencies = overrides ?? defaultExpiryCleanupDependencies;
  const session = await dependencies.getSession();
  if (!session) return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  if (session.user.role !== 'admin' && session.user.role !== 'superadmin') {
    return serverError(ErrorCode.FORBIDDEN, 'Forbidden');
  }
  try {
    const summary = await runReportExpiryCleanup(
      args.data.batchSize ?? DEFAULT_EXPIRY_BATCH_SIZE,
      session.user.id,
      dependencies,
    );
    return { summary };
  } catch {
    return serverError(ErrorCode.INTERNAL, 'Internal Server Error');
  }
}
