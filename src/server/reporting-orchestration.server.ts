import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { reportJobs } from '@/db/schema/report-jobs';
import { safeAuditLog } from '@/lib/audit';
import { ErrorCode, isServerError, serverError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import {
  completeReportJob,
  failReportJob,
  retryReportJob,
  startReportJob,
} from '@/lib/report-job-transitions.server';
import {
  getAvailableReportTypes,
  type ReportJobParameters,
  type ReportLocale,
  type ReportType,
  type ReportingRole,
} from '@/lib/reporting-policy';
import { getSessionFromHeaders } from './auth';
import {
  getAnalyticsSummaryHandler,
  getInstitutionalAcademicSummaryHandler,
  getOfficialTranscriptHandler,
} from './reporting-loaders.server';
import { renderReportPdf, type ReportPdfRequest } from './reporting-pdf-renderer.server';
import {
  createReportDownloadUrl,
  deleteReportArtifact,
  storeReportArtifact,
} from './report-storage.server';

type ReportJob = typeof reportJobs.$inferSelect;
type Session = Awaited<ReturnType<typeof getSessionFromHeaders>>;
type AuditEvent = Parameters<typeof safeAuditLog>[1];
type Artifact = Parameters<typeof completeReportJob>[1];
type SafeLogger = Pick<typeof logger, 'info' | 'error'>;

export interface ReportOrchestrationDependencies {
  getSession: () => Promise<Session | { user: { id: string; role: ReportingRole } }>;
  authorizeAndLoad: (
    type: ReportType,
    parameters: ReportJobParameters,
    requesterId: string,
  ) => Promise<unknown>;
  insertJob: (values: {
    reportType: ReportType;
    requesterId: string;
    parameters: ReportJobParameters;
    locale: ReportLocale;
  }) => Promise<ReportJob>;
  findOwnedJob: (jobId: number, requesterId: string) => Promise<ReportJob | null>;
  listOwnedJobs: (requesterId: string, limit: number) => Promise<ReportJob[]>;
  claimJob: (jobId: number) => Promise<ReportJob | null>;
  completeJob: (jobId: number, artifact: Artifact) => Promise<ReportJob | null>;
  failJob: (jobId: number, failure: { code: string; message: string }) => Promise<ReportJob | null>;
  resetFailedJob: (jobId: number) => Promise<ReportJob | null>;
  renderPdf: (request: ReportPdfRequest) => Promise<Buffer>;
  storeArtifact: (pdf: Buffer) => Promise<Artifact>;
  deleteArtifact: (artifactKey: string) => Promise<'deleted' | 'not_found'>;
  createDownloadUrl: (artifactKey: string) => Promise<string>;
  audit: (event: AuditEvent) => Promise<void>;
  log: SafeLogger;
  now: () => Date;
}

const NOT_FOUND = () => serverError(ErrorCode.NOT_FOUND, 'Report not found');
const INTERNAL = () => serverError(ErrorCode.INTERNAL, 'Internal Server Error');

function publicJob(job: ReportJob) {
  const safe: Partial<ReportJob> = { ...job };
  delete safe.artifactKey;
  delete safe.artifactSha256;
  delete safe.requesterId;
  return safe;
}

async function authorizeAndLoad(
  type: ReportType,
  parameters: ReportJobParameters,
  _requesterId: string,
) {
  const filters = {
    termId: parameters.termId,
    courseId: parameters.courseId,
    sectionId: parameters.sectionId,
    cohort: parameters.cohort,
  };
  if (type === 'institutional_academic_summary') {
    return getInstitutionalAcademicSummaryHandler({ data: filters });
  }
  if (type === 'analytics_summary') return getAnalyticsSummaryHandler({ data: filters });
  return getOfficialTranscriptHandler({ data: { ...filters, studentId: parameters.studentId } });
}

const defaultDependencies: ReportOrchestrationDependencies = {
  getSession: getSessionFromHeaders,
  authorizeAndLoad,
  async insertJob(values) {
    const [job] = await getDb().insert(reportJobs).values(values).returning();
    if (!job) throw new Error('Report job insert failed');
    return job;
  },
  async findOwnedJob(jobId, requesterId) {
    const [job] = await getDb()
      .select()
      .from(reportJobs)
      .where(and(eq(reportJobs.id, jobId), eq(reportJobs.requesterId, requesterId)))
      .limit(1);
    return job ?? null;
  },
  listOwnedJobs: (requesterId, limit) =>
    getDb()
      .select()
      .from(reportJobs)
      .where(eq(reportJobs.requesterId, requesterId))
      .orderBy(desc(reportJobs.createdAt))
      .limit(limit),
  claimJob: startReportJob,
  completeJob: completeReportJob,
  failJob: failReportJob,
  resetFailedJob: retryReportJob,
  renderPdf: renderReportPdf,
  storeArtifact: storeReportArtifact,
  deleteArtifact: deleteReportArtifact,
  createDownloadUrl: createReportDownloadUrl,
  audit: (event) => safeAuditLog(event.action, event),
  log: logger,
  now: () => new Date(),
};

function deps(overrides?: ReportOrchestrationDependencies): ReportOrchestrationDependencies {
  return overrides ?? defaultDependencies;
}

async function authenticated(dependencies: ReportOrchestrationDependencies) {
  const session = await dependencies.getSession();
  return session?.user ? session : null;
}

export async function processReportJob(
  jobId: number,
  requesterId: string,
  dependencies: ReportOrchestrationDependencies = defaultDependencies,
) {
  const job = await dependencies.claimJob(jobId);
  if (!job) return null;

  let artifact: Artifact | undefined;
  let completed = false;
  try {
    if (job.requesterId !== requesterId) throw new Error('Report requester mismatch');
    const data = await dependencies.authorizeAndLoad(
      job.reportType,
      job.parameters,
      job.requesterId,
    );
    if (isServerError(data)) throw new Error('Report data unavailable');

    const filters = {
      termId: job.parameters.termId,
      courseId: job.parameters.courseId,
      sectionId: job.parameters.sectionId,
      cohort: job.parameters.cohort,
    };
    const pdf = await dependencies.renderPdf({
      type: job.reportType,
      locale: job.locale,
      generatedAt: dependencies.now(),
      institution: { name: 'SIMAK' },
      filters,
      data,
    } as ReportPdfRequest);
    artifact = await dependencies.storeArtifact(pdf);
    const completedJob = await dependencies.completeJob(job.id, artifact);
    if (!completedJob) throw new Error('Report completion was stale');
    completed = true;

    await dependencies.audit({
      actorId: job.requesterId,
      action: 'report_generated',
      entityType: 'report_job',
      entityId: String(job.id),
      details: { reportType: job.reportType, attempts: completedJob.attempts },
    });
    dependencies.log.info({
      event: 'report_generated',
      reportJobId: job.id,
      reportType: job.reportType,
    });
    return completedJob;
  } catch {
    if (artifact && !completed) {
      try {
        await dependencies.deleteArtifact(artifact.artifactKey);
      } catch {
        dependencies.log.error({
          event: 'report_artifact_cleanup_failed',
          reportJobId: job.id,
          reportType: job.reportType,
        });
      }
    }
    const failed = await dependencies.failJob(job.id, {
      code: 'generation_failed',
      message: 'Report generation failed',
    });
    if (failed) {
      await dependencies.audit({
        actorId: job.requesterId,
        action: 'report_generation_failed',
        entityType: 'report_job',
        entityId: String(job.id),
        details: { reportType: job.reportType, attempts: failed.attempts },
      });
      dependencies.log.error({
        event: 'report_generation_failed',
        reportJobId: job.id,
        reportType: job.reportType,
      });
    }
    return failed;
  }
}

export async function requestReportHandler(
  args: {
    data: {
      reportType: ReportType;
      locale: ReportLocale;
      filters: ReportJobParameters;
      studentId?: string;
    };
  },
  overrides?: ReportOrchestrationDependencies,
) {
  const dependencies = deps(overrides);
  const session = await authenticated(dependencies);
  if (!session) return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  const role = session.user.role as ReportingRole;
  if (!getAvailableReportTypes(role).includes(args.data.reportType)) return NOT_FOUND();

  const parameters: ReportJobParameters = args.data.studentId
    ? { ...args.data.filters, studentId: args.data.studentId }
    : args.data.filters;
  try {
    const authorized = await dependencies.authorizeAndLoad(
      args.data.reportType,
      parameters,
      session.user.id,
    );
    if (isServerError(authorized)) return NOT_FOUND();

    const job = await dependencies.insertJob({
      reportType: args.data.reportType,
      requesterId: session.user.id,
      parameters,
      locale: args.data.locale,
    });
    await dependencies.audit({
      actorId: session.user.id,
      action: 'report_requested',
      entityType: 'report_job',
      entityId: String(job.id),
      details: { reportType: job.reportType },
    });
    dependencies.log.info({
      event: 'report_requested',
      reportJobId: job.id,
      reportType: job.reportType,
    });
    const generated = await processReportJob(job.id, session.user.id, dependencies);
    return { job: publicJob(generated ?? job) };
  } catch {
    return INTERNAL();
  }
}

export async function getReportStatusHandler(
  args: { data: { jobId: number } },
  overrides?: ReportOrchestrationDependencies,
) {
  const dependencies = deps(overrides);
  const session = await authenticated(dependencies);
  if (!session) return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  const job = await dependencies.findOwnedJob(args.data.jobId, session.user.id);
  return job ? { job: publicJob(job) } : NOT_FOUND();
}

export async function getReportHistoryHandler(
  args: { data: { limit: number } },
  overrides?: ReportOrchestrationDependencies,
) {
  const dependencies = deps(overrides);
  const session = await authenticated(dependencies);
  if (!session) return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  const jobs = await dependencies.listOwnedJobs(session.user.id, args.data.limit);
  return { jobs: jobs.map(publicJob) };
}

export async function retryReportHandler(
  args: { data: { jobId: number } },
  overrides?: ReportOrchestrationDependencies,
) {
  const dependencies = deps(overrides);
  const session = await authenticated(dependencies);
  if (!session) return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  const job = await dependencies.findOwnedJob(args.data.jobId, session.user.id);
  if (!job || job.state !== 'failed') return NOT_FOUND();
  const pending = await dependencies.resetFailedJob(job.id);
  if (!pending) return NOT_FOUND();
  await dependencies.audit({
    actorId: session.user.id,
    action: 'report_retried',
    entityType: 'report_job',
    entityId: String(job.id),
    details: { reportType: job.reportType },
  });
  dependencies.log.info({
    event: 'report_retried',
    reportJobId: job.id,
    reportType: job.reportType,
  });
  const generated = await processReportJob(job.id, session.user.id, dependencies);
  return { job: publicJob(generated ?? pending) };
}

export async function downloadReportHandler(
  args: { data: { jobId: number } },
  overrides?: ReportOrchestrationDependencies,
) {
  const dependencies = deps(overrides);
  const session = await authenticated(dependencies);
  if (!session) return serverError(ErrorCode.UNAUTHORIZED, 'Unauthorized');
  const job = await dependencies.findOwnedJob(args.data.jobId, session.user.id);
  if (
    !job ||
    job.state !== 'completed' ||
    !job.artifactKey ||
    !job.expiresAt ||
    job.expiresAt <= dependencies.now()
  ) {
    return NOT_FOUND();
  }
  try {
    const downloadUrl = await dependencies.createDownloadUrl(job.artifactKey);
    await dependencies.audit({
      actorId: session.user.id,
      action: 'report_downloaded',
      entityType: 'report_job',
      entityId: String(job.id),
      details: { reportType: job.reportType },
    });
    dependencies.log.info({
      event: 'report_downloaded',
      reportJobId: job.id,
      reportType: job.reportType,
    });
    return { downloadUrl };
  } catch {
    return NOT_FOUND();
  }
}
