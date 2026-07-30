// Client-safe server function wrappers (Zod schemas + typedServerFn stubs)
// Handler implementations are in dashboard.server.ts (not bundled for client)
import { RATE_LIMITS } from '@/lib/rate-limiter';
import { typedServerFn } from '@/lib/server-fn';
import { z } from 'zod';

export const GetStudentDashboardDataSchema = z.object({});

export const GetInstructorDashboardDataSchema = z.object({});

export const GetAdminDashboardDataSchema = z.object({});

export const getStudentDashboardData = typedServerFn({
  method: 'GET',
  rateLimit: RATE_LIMITS.standardRead,
}).handler(async () => {
  const { getStudentDashboardDataHandler } = await import('./dashboard.server');
  return getStudentDashboardDataHandler();
});

export const getInstructorDashboardData = typedServerFn({
  method: 'GET',
  rateLimit: RATE_LIMITS.standardRead,
}).handler(async () => {
  const { getInstructorDashboardDataHandler } = await import('./dashboard.server');
  return getInstructorDashboardDataHandler();
});

export const getAdminDashboardData = typedServerFn({
  method: 'GET',
  rateLimit: RATE_LIMITS.standardRead,
}).handler(async () => {
  const { getAdminDashboardDataHandler } = await import('./dashboard.server');
  return getAdminDashboardDataHandler();
});
