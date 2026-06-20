// Client-safe server function wrappers (Zod schemas + createServerFn stubs)
// Handler implementations are in audit-logs.server.ts (not bundled for client)
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

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

export const listAuditLogs = createServerFn({ method: 'GET' })
  .inputValidator(ListAuditLogsSchema)
  .handler(async ({ data }) => {
    const { listAuditLogsHandler } = await import('./audit-logs.server');
    return listAuditLogsHandler({ data });
  });

export const getAuditLogDetail = createServerFn({ method: 'GET' })
  .inputValidator(GetAuditLogDetailSchema)
  .handler(async ({ data }) => {
    const { getAuditLogDetailHandler } = await import('./audit-logs.server');
    return getAuditLogDetailHandler({ data });
  });
