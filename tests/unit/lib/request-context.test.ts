/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetRequestHeaders } = vi.hoisted(() => ({
  mockGetRequestHeaders: vi.fn(),
}));

// Mock @tanstack/react-start — capture the .server() callback as requestIdMiddleware
vi.mock('@tanstack/react-start', () => ({
  createMiddleware: vi.fn().mockReturnValue({
    server: vi.fn().mockImplementation((fn) => fn),
  }),
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: mockGetRequestHeaders,
}));

// Import after mocks are set up
import { requestIdMiddleware } from '@/lib/request-context';
import { requestContextStorage } from '@/lib/request-context-store';

// The mock makes createMiddleware().server(fn) return fn directly,
// but TypeScript sees the real RequestMiddlewareAfterServer type.
// Cast to a callable for test invocation.
type MiddlewareFn = (opts: {
  next: ReturnType<typeof vi.fn>;
  request: Request;
  context: Record<string, unknown>;
  pathname: string;
  handlerType: string;
}) => Promise<unknown>;

const middleware = requestIdMiddleware as unknown as MiddlewareFn;

describe('request-context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestHeaders.mockReturnValue(new Headers());
  });

  describe('requestIdMiddleware', () => {
    it('reads x-request-id header when present and passes it to next', async () => {
      const mockNext = vi.fn().mockResolvedValue({});
      const request = new Request('https://example.com/api', {
        headers: { 'x-request-id': 'existing-id-123' },
      });
      mockGetRequestHeaders.mockReturnValue(request.headers);

      await middleware({
        next: mockNext,
        request,
        context: {},
        pathname: '/api',
        handlerType: 'rpc',
      });

      expect(mockNext).toHaveBeenCalledOnce();
      expect(mockNext).toHaveBeenCalledWith({
        context: { requestId: 'existing-id-123' },
      });
    });

    it('generates a UUID when x-request-id header is absent', async () => {
      const mockNext = vi.fn().mockResolvedValue({});
      const request = new Request('https://example.com/api');
      mockGetRequestHeaders.mockReturnValue(request.headers);

      await middleware({
        next: mockNext,
        request,
        context: {},
        pathname: '/api',
        handlerType: 'rpc',
      });

      expect(mockNext).toHaveBeenCalledOnce();
      const callArg = mockNext.mock.calls[0][0];
      expect(callArg.context).toHaveProperty('requestId');
      // Validate UUID v4 format
      expect(callArg.context.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('stores the request ID while next executes', async () => {
      const mockNext = vi.fn().mockImplementation(async () => {
        expect(requestContextStorage.getStore()?.requestId).toBe('existing-id-123');
      });
      const request = new Request('https://example.com/api', {
        headers: { 'x-request-id': 'existing-id-123' },
      });
      mockGetRequestHeaders.mockReturnValue(request.headers);

      await middleware({
        next: mockNext,
        request,
        context: {},
        pathname: '/api',
        handlerType: 'rpc',
      });
    });

    it('clears the request ID after next returns', async () => {
      const mockNext = vi.fn().mockResolvedValue({});
      const request = new Request('https://example.com/api', {
        headers: { 'x-request-id': 'existing-id-123' },
      });
      mockGetRequestHeaders.mockReturnValue(request.headers);

      await middleware({
        next: mockNext,
        request,
        context: {},
        pathname: '/api',
        handlerType: 'rpc',
      });

      expect(requestContextStorage.getStore()).toBeUndefined();
    });
  });
});
