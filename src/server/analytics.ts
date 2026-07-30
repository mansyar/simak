// Client-safe server function wrappers (Zod schemas + typedServerFn stubs)
// Handler implementations are in analytics-admin.server.ts, analytics-instructor.server.ts,
// and analytics-export.server.ts (not bundled for client)
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { serverFnMiddlewares, typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';
import {
  getAdminAnalyticsDataHandler,
  getAdminRubricAnalyticsHandler,
} from './analytics-admin.server';
import {
  exportAssignmentProgressCsvHandler,
  exportAuditLogCsvHandler,
  exportGradebookCsvHandler,
  exportReviewHistoryCsvHandler,
  exportRubricScoresCsvHandler,
  exportStudentProgressCsvHandler,
  exportUsersCsvHandler,
} from './analytics-export.server';
import {
  getInstructorAnalyticsDataHandler,
  getInstructorRubricAnalyticsHandler,
} from './analytics-instructor.server';

export const AnalyticsDateRangeSchema = z
  .object({
    range: z.enum(['7d', '30d', '90d', 'all']).optional(),
    start: z.coerce.date().optional(),
    end: z.coerce.date().optional(),
  })
  .refine(
    (data) => {
      // If either start or end is provided, both must be provided
      if (data.start !== undefined || data.end !== undefined) {
        return data.start !== undefined && data.end !== undefined;
      }
      return true;
    },
    { message: 'Both start and end dates are required for custom date range' },
  )
  .refine(
    (data) => {
      // If both dates are provided, start must be before end
      if (data.start && data.end) {
        return data.start < data.end;
      }
      return true;
    },
    { message: 'Start date must be before end date' },
  );

export const getAdminAnalyticsData = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(AnalyticsDateRangeSchema)
  .handler(async ({ data }) => {
    return getAdminAnalyticsDataHandler({ data });
  });

export const getInstructorAnalyticsData = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(AnalyticsDateRangeSchema)
  .handler(async ({ data }) => {
    return getInstructorAnalyticsDataHandler({ data });
  });

export const getInstructorRubricAnalytics = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(AnalyticsDateRangeSchema)
  .handler(async ({ data }) => {
    return getInstructorRubricAnalyticsHandler({ data });
  });

export const getAdminRubricAnalytics = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(AnalyticsDateRangeSchema)
  .handler(async ({ data }) => {
    return getAdminRubricAnalyticsHandler({ data });
  });

// ---- CSV Export Schemas ----

export const ExportUsersCsvSchema = z.object({});

export const ExportAuditLogCsvSchema = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const ExportAssignmentProgressCsvSchema = z.object({});

export const ExportStudentProgressCsvSchema = z.object({
  assignmentId: z.coerce.number().int().positive('Assignment ID must be a positive integer'),
});

export const ExportReviewHistoryCsvSchema = z.object({
  assignmentId: z.coerce.number().int().positive('Assignment ID must be a positive integer'),
});

export const ExportRubricScoresCsvSchema = z.object({
  assignmentId: z.coerce.number().int().positive('Assignment ID must be a positive integer'),
});

export const ExportGradebookCsvSchema = z.object({
  assignmentId: z.coerce.number().int().positive('Assignment ID must be a positive integer'),
});

// ---- CSV Export Server Function Stubs ----

export const exportUsersCsv = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(ExportUsersCsvSchema)
  .handler(async ({ data }) => {
    return exportUsersCsvHandler({ data });
  });

export const exportAuditLogCsv = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(ExportAuditLogCsvSchema)
  .handler(async ({ data }) => {
    return exportAuditLogCsvHandler({ data });
  });

export const exportAssignmentProgressCsv = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(ExportAssignmentProgressCsvSchema)
  .handler(async ({ data }) => {
    return exportAssignmentProgressCsvHandler({ data });
  });

export const exportStudentProgressCsv = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(ExportStudentProgressCsvSchema)
  .handler(async ({ data }) => {
    return exportStudentProgressCsvHandler({ data });
  });

export const exportReviewHistoryCsv = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(ExportReviewHistoryCsvSchema)
  .handler(async ({ data }) => {
    return exportReviewHistoryCsvHandler({ data });
  });

export const exportRubricScoresCsv = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(ExportRubricScoresCsvSchema)
  .handler(async ({ data }) => {
    return exportRubricScoresCsvHandler({ data });
  });

export const exportGradebookCsv = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(ExportGradebookCsvSchema)
  .handler(async ({ data }) => {
    return exportGradebookCsvHandler({ data });
  });
