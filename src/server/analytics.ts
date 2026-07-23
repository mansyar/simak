// Client-safe server function wrappers (Zod schemas + createServerFn stubs)
// Handler implementations are in analytics-admin.server.ts, analytics-instructor.server.ts,
// and analytics-export.server.ts (not bundled for client)
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

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

export const getAdminAnalyticsData = createServerFn({ method: 'GET' })
  .inputValidator(AnalyticsDateRangeSchema)
  .handler(async ({ data }) => {
    const { getAdminAnalyticsDataHandler } = await import('./analytics-admin.server');
    return getAdminAnalyticsDataHandler({ data });
  });

export const getInstructorAnalyticsData = createServerFn({ method: 'GET' })
  .inputValidator(AnalyticsDateRangeSchema)
  .handler(async ({ data }) => {
    const { getInstructorAnalyticsDataHandler } = await import('./analytics-instructor.server');
    return getInstructorAnalyticsDataHandler({ data });
  });

export const getInstructorRubricAnalytics = createServerFn({ method: 'GET' })
  .inputValidator(AnalyticsDateRangeSchema)
  .handler(async ({ data }) => {
    const { getInstructorRubricAnalyticsHandler } = await import('./analytics-instructor.server');
    return getInstructorRubricAnalyticsHandler({ data });
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

// ---- CSV Export Server Function Stubs ----

export const exportUsersCsv = createServerFn({ method: 'GET' })
  .inputValidator(ExportUsersCsvSchema)
  .handler(async ({ data }) => {
    const { exportUsersCsvHandler } = await import('./analytics-export.server');
    return exportUsersCsvHandler({ data });
  });

export const exportAuditLogCsv = createServerFn({ method: 'GET' })
  .inputValidator(ExportAuditLogCsvSchema)
  .handler(async ({ data }) => {
    const { exportAuditLogCsvHandler } = await import('./analytics-export.server');
    return exportAuditLogCsvHandler({ data });
  });

export const exportAssignmentProgressCsv = createServerFn({ method: 'GET' })
  .inputValidator(ExportAssignmentProgressCsvSchema)
  .handler(async ({ data }) => {
    const { exportAssignmentProgressCsvHandler } = await import('./analytics-export.server');
    return exportAssignmentProgressCsvHandler({ data });
  });

export const exportStudentProgressCsv = createServerFn({ method: 'GET' })
  .inputValidator(ExportStudentProgressCsvSchema)
  .handler(async ({ data }) => {
    const { exportStudentProgressCsvHandler } = await import('./analytics-export.server');
    return exportStudentProgressCsvHandler({ data });
  });

export const exportReviewHistoryCsv = createServerFn({ method: 'GET' })
  .inputValidator(ExportReviewHistoryCsvSchema)
  .handler(async ({ data }) => {
    const { exportReviewHistoryCsvHandler } = await import('./analytics-export.server');
    return exportReviewHistoryCsvHandler({ data });
  });
