// Client-safe reporting server-function wrappers.
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { serverFnMiddlewares, typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';

export const ReportCatalogInputSchema = z.object({});

const reportFiltersSchema = z
  .object({
    termId: z.number().int().positive().nullish(),
    courseId: z.number().int().positive().nullish(),
    sectionId: z.number().int().positive().nullish(),
    cohort: z.string().trim().min(1).max(120).nullish(),
  })
  .transform((filters) => ({
    termId: filters.termId ?? null,
    courseId: filters.courseId ?? null,
    sectionId: filters.sectionId ?? null,
    cohort: filters.cohort ?? null,
  }));

export const InstitutionalAcademicSummaryInputSchema = reportFiltersSchema;
export const AnalyticsSummaryInputSchema = reportFiltersSchema;
export const OfficialTranscriptInputSchema = z
  .object({ studentId: z.string().trim().min(1).max(255).optional() })
  .and(
    z.object({
      termId: z.number().int().positive().nullish(),
      courseId: z.number().int().positive().nullish(),
      sectionId: z.number().int().positive().nullish(),
      cohort: z.string().trim().min(1).max(120).nullish(),
    }),
  )
  .transform((input) => ({
    studentId: input.studentId,
    termId: input.termId ?? null,
    courseId: input.courseId ?? null,
    sectionId: input.sectionId ?? null,
    cohort: input.cohort ?? null,
  }));

export type ReportLoaderFilters = z.infer<typeof InstitutionalAcademicSummaryInputSchema>;
export type OfficialTranscriptInput = z.infer<typeof OfficialTranscriptInputSchema>;

const requestReportFields = {
  locale: z.enum(['en', 'id']),
  filters: reportFiltersSchema,
};

export const RequestReportInputSchema = z.discriminatedUnion('reportType', [
  z
    .object({
      reportType: z.literal('institutional_academic_summary'),
      ...requestReportFields,
    })
    .strict(),
  z
    .object({
      reportType: z.literal('analytics_summary'),
      ...requestReportFields,
    })
    .strict(),
  z
    .object({
      reportType: z.literal('official_transcript'),
      ...requestReportFields,
      studentId: z.string().trim().min(1).max(255).optional(),
    })
    .strict(),
]);
export const ReportJobInputSchema = z.object({ jobId: z.number().int().positive() });
export const ReportHistoryInputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
});

export const getReportCatalog = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(ReportCatalogInputSchema)
  .handler(async ({ data }) => {
    const { getReportCatalogHandler } = await import('./reporting.server');
    return getReportCatalogHandler({ data });
  });

export const getInstitutionalAcademicSummary = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(InstitutionalAcademicSummaryInputSchema)
  .handler(async ({ data }) => {
    const { getInstitutionalAcademicSummaryHandler } = await import('./reporting-loaders.server');
    return getInstitutionalAcademicSummaryHandler({ data });
  });

export const getAnalyticsSummary = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(AnalyticsSummaryInputSchema)
  .handler(async ({ data }) => {
    const { getAnalyticsSummaryHandler } = await import('./reporting-loaders.server');
    return getAnalyticsSummaryHandler({ data });
  });

export const getOfficialTranscript = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(OfficialTranscriptInputSchema)
  .handler(async ({ data }) => {
    const { getOfficialTranscriptHandler } = await import('./reporting-loaders.server');
    return getOfficialTranscriptHandler({ data });
  });

export const requestReport = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(RequestReportInputSchema)
  .handler(async ({ data }) => {
    const { requestReportHandler } = await import('./reporting-orchestration.server');
    return requestReportHandler({ data });
  });

export const getReportStatus = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(ReportJobInputSchema)
  .handler(async ({ data }) => {
    const { getReportStatusHandler } = await import('./reporting-orchestration.server');
    return getReportStatusHandler({ data });
  });

export const getReportHistory = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(ReportHistoryInputSchema)
  .handler(async ({ data }) => {
    const { getReportHistoryHandler } = await import('./reporting-orchestration.server');
    return getReportHistoryHandler({ data });
  });

export const retryReport = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.destructive))
  .inputValidator(ReportJobInputSchema)
  .handler(async ({ data }) => {
    const { retryReportHandler } = await import('./reporting-orchestration.server');
    return retryReportHandler({ data });
  });

export const downloadReport = typedServerFn({ method: 'POST' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(ReportJobInputSchema)
  .handler(async ({ data }) => {
    const { downloadReportHandler } = await import('./reporting-orchestration.server');
    return downloadReportHandler({ data });
  });
