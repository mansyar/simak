// Client-safe server function wrappers (Zod schemas + typedServerFn stubs)
// Handler implementations are in audit-log.server.ts (not bundled for client)
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { serverFnMiddlewares, typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';
import { getAuditLogDetailHandler, listAuditLogsHandler } from './audit-log.server';

export const ListAuditLogsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  action: z.string().optional().default(''),
  dateFrom: z.string().optional().default(''),
  dateTo: z.string().optional().default(''),
  search: z.string().optional().default(''),
});

export const GetAuditLogDetailSchema = z.object({
  id: z.coerce.number().int().min(1),
});

export const listAuditLogs = typedServerFn({ method: 'GET' })
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(ListAuditLogsSchema)
  .handler(async ({ data }) => {
    return listAuditLogsHandler({ data });
  });

export const getAuditLogDetail = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .inputValidator(GetAuditLogDetailSchema)
  .handler(async ({ data }) => {
    return getAuditLogDetailHandler({ data });
  });
