// Client-safe server function wrappers (Zod schemas + createServerFn stubs)
// Handler implementations are in dashboard.server.ts (not bundled for client)
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

export const GetStudentDashboardDataSchema = z.object({});

export const GetInstructorDashboardDataSchema = z.object({});

export const GetAdminDashboardDataSchema = z.object({});

export const getStudentDashboardData = createServerFn({ method: 'GET' }).handler(
  async (args: { data: any }) => {
    const { getStudentDashboardDataHandler } = await import('./dashboard.server');
    const data = GetStudentDashboardDataSchema.parse(args.data);
    return getStudentDashboardDataHandler({ data });
  },
);

export const getInstructorDashboardData = createServerFn({ method: 'GET' }).handler(
  async (args: { data: any }) => {
    const { getInstructorDashboardDataHandler } = await import('./dashboard.server');
    const data = GetInstructorDashboardDataSchema.parse(args.data);
    return getInstructorDashboardDataHandler({ data });
  },
);

export const getAdminDashboardData = createServerFn({ method: 'GET' }).handler(
  async (args: { data: any }) => {
    const { getAdminDashboardDataHandler } = await import('./dashboard.server');
    const data = GetAdminDashboardDataSchema.parse(args.data);
    return getAdminDashboardDataHandler({ data });
  },
);
