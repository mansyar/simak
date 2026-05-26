// Client-safe server function wrappers (Zod schemas + createServerFn stubs)
// Handler implementations are in dashboard.server.ts (not bundled for client)
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

export const GetStudentDashboardDataSchema = z.object({});

export const GetInstructorDashboardDataSchema = z.object({});

export const GetAdminDashboardDataSchema = z.object({});

export const getStudentDashboardData = createServerFn({ method: 'GET' }).handler(async () => {
  const { getStudentDashboardDataHandler } = await import('./dashboard.server');
  return getStudentDashboardDataHandler();
});

export const getInstructorDashboardData = createServerFn({ method: 'GET' }).handler(async () => {
  const { getInstructorDashboardDataHandler } = await import('./dashboard.server');
  return getInstructorDashboardDataHandler();
});

export const getAdminDashboardData = createServerFn({ method: 'GET' }).handler(async () => {
  const { getAdminDashboardDataHandler } = await import('./dashboard.server');
  return getAdminDashboardDataHandler();
});
