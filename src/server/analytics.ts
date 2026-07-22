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
