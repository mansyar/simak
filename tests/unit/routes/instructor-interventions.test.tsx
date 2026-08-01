/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: vi.fn().mockReturnValue(new Headers()),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    middleware: vi.fn().mockReturnThis(),
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
  createMiddleware: vi.fn().mockReturnValue({
    server: vi.fn().mockImplementation((fn) => fn),
  }),
}));

const routeConfig: any = {};
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn().mockImplementation(() => (config: any) => {
    Object.assign(routeConfig, config);
    return {
      ...config,
      useLoaderData: vi.fn(),
      useSearch: vi.fn(),
      useNavigate: vi.fn(),
    };
  }),
}));

vi.mock('@/server/interventions', () => ({
  listInterventions: vi.fn(),
  getInterventionContext: vi.fn(),
  createIntervention: vi.fn(),
  updateIntervention: vi.fn(),
}));
vi.mock('@/routes/__root', () => ({ useI18n: () => ({ t: (key: string) => key }) }));

describe('Instructor interventions route', () => {
  it('exports a loader with validated status, overdue, ownership, and pagination search', async () => {
    const { Route } = await import('@/routes/_authenticated/instructor/interventions/index');

    expect(Route).toBeDefined();
    expect(Route).toHaveProperty('loader');
    expect(routeConfig.validateSearch).toBeTypeOf('function');
    expect(routeConfig.loaderDeps).toBeTypeOf('function');

    const search = routeConfig.validateSearch({
      status: 'monitoring',
      overdue: 'true',
      assignmentId: '3',
      studentId: 'student-1',
      page: '2',
      limit: '10',
    });
    expect(search).toEqual({
      status: 'monitoring',
      overdue: true,
      assignmentId: 3,
      studentId: 'student-1',
      page: 2,
      limit: 10,
    });
  });
});
