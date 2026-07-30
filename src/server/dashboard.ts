// Client-safe server function wrappers (Zod schemas + typedServerFn stubs)
// Handler implementations are in dashboard.server.ts (not bundled for client)
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { serverFnMiddlewares, typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';
import {
  getAdminDashboardDataHandler,
  getInstructorDashboardDataHandler,
  getStudentDashboardDataHandler,
} from './dashboard.server';

export const GetStudentDashboardDataSchema = z.object({});

export const GetInstructorDashboardDataSchema = z.object({});

export const GetAdminDashboardDataSchema = z.object({});

export const getStudentDashboardData = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .handler(async () => {
    return getStudentDashboardDataHandler();
  });

export const getInstructorDashboardData = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .handler(async () => {
    return getInstructorDashboardDataHandler();
  });

export const getAdminDashboardData = typedServerFn({
  method: 'GET',
})
  .middleware(serverFnMiddlewares(RATE_LIMITS.standardRead))
  .handler(async () => {
    return getAdminDashboardDataHandler();
  });
