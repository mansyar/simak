/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreateRouter, mockGetGlobalStartContext } = vi.hoisted(() => ({
  mockCreateRouter: vi.fn((opts: unknown) => opts),
  mockGetGlobalStartContext: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  createRouter: mockCreateRouter,
}));

vi.mock('@tanstack/react-start', () => ({
  getGlobalStartContext: mockGetGlobalStartContext,
}));

vi.mock('@/routeTree.gen', () => ({
  routeTree: {},
}));

// Prevent the dynamic import('./lib/email-queue-init') in router.tsx from loading
// the real email queue module chain (which imports postal-mime and throws an
// unhandled rejection in the test environment). The router test verifies nonce
// propagation, not email queue functionality.
vi.mock('@/lib/email-queue-init', () => ({
  startEmailQueue: vi.fn(),
}));

import { getRouter } from '@/router';

describe('getRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes nonce from start context to ssr config', () => {
    mockGetGlobalStartContext.mockReturnValue({ nonce: 'abc123nonce' });

    getRouter();

    expect(mockCreateRouter).toHaveBeenCalledTimes(1);
    const opts = mockCreateRouter.mock.calls[0][0] as {
      ssr?: { nonce?: string };
    };
    expect(opts.ssr).toEqual({ nonce: 'abc123nonce' });
  });

  it('passes undefined nonce when start context has no nonce', () => {
    mockGetGlobalStartContext.mockReturnValue(undefined);

    getRouter();

    expect(mockCreateRouter).toHaveBeenCalledTimes(1);
    const opts = mockCreateRouter.mock.calls[0][0] as {
      ssr?: { nonce?: string };
    };
    expect(opts.ssr).toEqual({ nonce: undefined });
  });

  it('preserves existing router options', () => {
    mockGetGlobalStartContext.mockReturnValue({ nonce: 'test-nonce' });

    getRouter();

    const opts = mockCreateRouter.mock.calls[0][0] as {
      routeTree?: unknown;
      scrollRestoration?: boolean;
      defaultPreload?: boolean;
    };
    expect(opts.routeTree).toBeDefined();
    expect(opts.scrollRestoration).toBe(true);
    expect(opts.defaultPreload).toBe(false);
  });
});
