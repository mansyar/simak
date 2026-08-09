import type { ReportJobState, ReportLocale, ReportType } from '@/lib/reporting-policy';

// Client-safe projection of a report job. Never exposes artifact keys,
// requester identity, or internal failure details.
export type ReportHistoryJob = {
  id: number;
  reportType: ReportType;
  locale: ReportLocale;
  state: ReportJobState;
  createdAt: Date;
  completedAt: Date | null;
  failedAt: Date | null;
  expiresAt: Date | null;
};

export type ReportHistoryJobInput = {
  id?: number | null;
  reportType?: ReportType | null;
  locale?: ReportLocale | null;
  state?: ReportJobState | null;
  createdAt?: Date | string | null;
  completedAt?: Date | string | null;
  failedAt?: Date | string | null;
  expiresAt?: Date | string | null;
};

const ACTIVE_STATES: ReadonlySet<ReportJobState> = new Set(['pending', 'processing']);

export function toReportHistoryJob(raw: ReportHistoryJobInput): ReportHistoryJob | null {
  if (!raw.id || !raw.reportType || !raw.locale || !raw.state || !raw.createdAt) {
    return null;
  }
  return {
    id: raw.id,
    reportType: raw.reportType,
    locale: raw.locale,
    state: raw.state,
    createdAt: new Date(raw.createdAt),
    completedAt: raw.completedAt ? new Date(raw.completedAt) : null,
    failedAt: raw.failedAt ? new Date(raw.failedAt) : null,
    expiresAt: raw.expiresAt ? new Date(raw.expiresAt) : null,
  };
}

export function hasActiveReportJobs(jobs: readonly ReportHistoryJob[]): boolean {
  return jobs.some((job) => ACTIVE_STATES.has(job.state));
}

export function isReportExpired(job: ReportHistoryJob, now: Date = new Date()): boolean {
  if (job.state === 'expired') return true;
  return (
    job.state === 'completed' && job.expiresAt !== null && job.expiresAt.getTime() <= now.getTime()
  );
}

export function isReportDownloadable(job: ReportHistoryJob, now: Date = new Date()): boolean {
  return job.state === 'completed' && !isReportExpired(job, now);
}
