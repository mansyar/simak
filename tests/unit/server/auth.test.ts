/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Create the mock function in a hoisted context so it's available before vi.mock runs
const { mockGetSessionHandler } = vi.hoisted(() => ({
  mockGetSessionHandler: vi.fn(),
}));

// Mock @tanstack/react-start/server
vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: vi.fn().mockReturnValue(new Headers()),
}));

// Mock @tanstack/react-start - createServerFn returns chainable that .handler() returns a callable
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

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  redirect: vi.fn().mockImplementation((opts) => {
    throw new Error(`REDIRECT: ${opts.to}`);
  }),
}));

// Mock route-utils
vi.mock('@/lib/route-utils', () => ({
  getRoleDashboard: vi.fn().mockImplementation((role: string) => {
    const dashboards: Record<string, string> = {
      superadmin: '/admin/dashboard',
      admin: '/admin/dashboard',
      instructor: '/instructor/dashboard',
      student: '/student/dashboard',
    };
    return dashboards[role] || '/dashboard';
  }),
}));

// Mock auth.server for delegation tests — uses hoisted mock function
vi.mock('@/server/auth.server', () => ({
  getSessionHandler: mockGetSessionHandler,
}));

import { getSessionFromHeaders, requireRole } from '@/server/auth';

// Read auth.ts source for file-content assertions
const authTsContent = readFileSync(resolve(process.cwd(), 'src/server/auth.ts'), 'utf-8');

// Helper to create a mock Session object
function createMockSession(role: string = 'admin') {
  return {
    user: {
      id: 'user-123',
      name: 'Test User',
      email: 'test@example.com',
      role,
      locale: 'en',
      emailVerified: true,
      image: null,
    },
    session: {
      id: 'session-123',
      token: 'token-abc',
      expiresAt: new Date('2026-12-31'),
    },
  };
}

describe('auth.ts client-safe stub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('file-content assertions (AC-1: no forbidden imports)', () => {
    it('should not import drizzle-orm', () => {
      expect(authTsContent).not.toMatch(/drizzle-orm/);
    });

    it('should not import from db/index', () => {
      expect(authTsContent).not.toMatch(/db\/index/);
    });

    it('should not import from db/schema', () => {
      expect(authTsContent).not.toMatch(/db\/schema/);
    });

    it('should not import from auth/config', () => {
      expect(authTsContent).not.toMatch(/auth\/config/);
    });

    it('should not import getRequestHeaders', () => {
      expect(authTsContent).not.toMatch(/getRequestHeaders/);
    });

    it('should statically import getSessionHandler from auth.server', () => {
      expect(authTsContent).toMatch(
        /import\s*\{\s*getSessionHandler\s*\}\s*from\s*['"]\.\/auth\.server['"]\s*;/,
      );
    });
  });

  describe('delegation to auth.server.ts', () => {
    it('should call getSessionHandler when getSessionFromHeaders is called', async () => {
      mockGetSessionHandler.mockResolvedValue(null);

      await getSessionFromHeaders();

      expect(mockGetSessionHandler).toHaveBeenCalled();
    });

    it('should return what getSessionHandler returns', async () => {
      const mockSession = createMockSession('admin');
      mockGetSessionHandler.mockResolvedValue(mockSession as any);

      const result = await getSessionFromHeaders();

      expect(result).toEqual(mockSession);
    });

    it('should return null when getSessionHandler returns null', async () => {
      mockGetSessionHandler.mockResolvedValue(null);

      const result = await getSessionFromHeaders();

      expect(result).toBeNull();
    });
  });

  describe('requireRole', () => {
    it('should throw redirect when no session exists', async () => {
      mockGetSessionHandler.mockResolvedValue(null);

      await expect(requireRole(['admin'])).rejects.toThrow('REDIRECT: /auth/login');
    });

    it('should throw redirect when user does not have required role', async () => {
      mockGetSessionHandler.mockResolvedValue(createMockSession('student') as any);

      await expect(requireRole(['admin', 'instructor'])).rejects.toThrow(
        'REDIRECT: /student/dashboard',
      );
    });

    it('should return session when user has required role', async () => {
      mockGetSessionHandler.mockResolvedValue(createMockSession('admin') as any);

      const result = await requireRole(['admin']);

      expect(result).toBeDefined();
      expect(result?.user.role).toBe('admin');
      expect(result?.user.id).toBe('user-123');
    });

    it('should redirect to correct dashboard based on user role', async () => {
      mockGetSessionHandler.mockResolvedValue(createMockSession('instructor') as any);

      // Try to access admin-only route as instructor
      await expect(requireRole(['admin'])).rejects.toThrow('REDIRECT: /instructor/dashboard');
    });

    it('should accept multiple roles', async () => {
      mockGetSessionHandler.mockResolvedValue(createMockSession('admin') as any);

      // Should pass with multiple allowed roles
      const result = await requireRole(['superadmin', 'admin']);

      expect(result).toBeDefined();
      expect(result?.user.role).toBe('admin');
    });

    it('should throw redirect for superadmin when only student role allowed', async () => {
      mockGetSessionHandler.mockResolvedValue(createMockSession('superadmin') as any);

      await expect(requireRole(['student'])).rejects.toThrow('REDIRECT: /admin/dashboard');
    });
  });
});
