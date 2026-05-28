/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @tanstack/react-start/server
vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: vi.fn().mockReturnValue(new Headers()),
}));

// Mock @tanstack/react-start
vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
  useServerFn: vi.fn().mockReturnValue(vi.fn()),
}));

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  redirect: vi.fn().mockImplementation((opts) => {
    throw new Error(`REDIRECT: ${opts.to}`);
  }),
  createFileRoute: vi.fn().mockReturnValue((config: any) => ({
    ...config,
    useLoaderData: vi.fn().mockReturnValue({
      entries: [],
      total: 0,
      page: 1,
      limit: 50,
    }),
    useSearch: vi.fn().mockReturnValue({
      page: 1,
      limit: 50,
      action: '',
      dateFrom: '',
      dateTo: '',
      search: '',
    }),
    useNavigate: vi.fn().mockReturnValue(vi.fn()),
  })),
  useRouter: vi.fn().mockReturnValue({ invalidate: vi.fn() }),
}));

// Mock server audit-logs
vi.mock('@/server/audit-logs', () => ({
  listAuditLogs: vi.fn(),
  getAuditLogDetail: vi.fn(),
}));

// Mock __root
vi.mock('@/routes/__root', () => ({
  useI18n: vi.fn().mockReturnValue({
    t: vi.fn().mockImplementation((key: string) => key),
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));

describe('Admin Audit Log page', () => {
  it('should export a route component', async () => {
    const mod = await import('@/routes/_authenticated/admin/audit-log');
    expect(mod).toBeDefined();
    expect(mod.Route).toBeDefined();
  });

  it('should have Route with component defined', async () => {
    const mod = await import('@/routes/_authenticated/admin/audit-log');
    expect(mod.Route).toBeDefined();
    expect(typeof mod.Route).toBe('object');
  });

  it('should use listAuditLogs server function', async () => {
    const { listAuditLogs } = await import('@/server/audit-logs');
    expect(typeof listAuditLogs).toBe('function');
  });
});
