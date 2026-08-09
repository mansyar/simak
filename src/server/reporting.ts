// Client-safe reporting server-function wrappers.
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { serverFnMiddlewares, typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';

export const ReportCatalogInputSchema = z.object({});

export const getReportCatalog = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(ReportCatalogInputSchema)
  .handler(async ({ data }) => {
    const { getReportCatalogHandler } = await import('./reporting.server');
    return getReportCatalogHandler({ data });
  });
