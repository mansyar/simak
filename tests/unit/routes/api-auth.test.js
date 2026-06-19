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
}));
// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  redirect: vi.fn().mockImplementation((opts) => {
    throw new Error(`REDIRECT: ${opts.to}`);
  }),
  createFileRoute: vi.fn().mockReturnValue((config) => config),
}));
// Mock auth config
vi.mock('@/auth/config', () => ({
  auth: {
    handler: vi.fn().mockResolvedValue(new Response('OK')),
  },
}));
describe('API Auth Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('should export Route', async () => {
    const { Route } = await import('@/routes/api/auth/$');
    expect(Route).toBeDefined();
  });
  it('should have server config', async () => {
    const { Route } = await import('@/routes/api/auth/$');
    // The route should have server handlers configured
    expect(Route).toHaveProperty('server');
  });
});
