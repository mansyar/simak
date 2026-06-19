/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @tanstack/react-start/server
vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: vi.fn().mockReturnValue(new Headers()),
}));

// Mock @tanstack/react-start - createServerFn returns chainable that .handler() returns a callable
vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  redirect: vi.fn().mockImplementation((opts) => {
    throw new Error(`REDIRECT: ${opts.to}`);
  }),
}));

// Mock database
vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

// Mock auth config
vi.mock('@/auth/config', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
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

// Mock users schema
vi.mock('@/db/schema/users', () => ({
  users: {
    id: 'id',
    role: 'role',
    locale: 'locale',
  },
}));

import { getSessionFromHeaders, requireRole } from '@/server/auth';
import { auth } from '@/auth/config';
import { getDb } from '@/db/index';

// Helper to create mock session objects with all required fields
function createMockSession(
  overrides: {
    userId?: string;
    userName?: string;
    userEmail?: string;
    userRole?: string;
    userLocale?: string;
    emailVerified?: boolean;
    image?: string | null;
    sessionId?: string;
    token?: string;
    expiresAt?: Date;
  } = {},
) {
  const now = new Date();
  return {
    user: {
      id: overrides.userId ?? 'user-123',
      createdAt: now,
      updatedAt: now,
      name: overrides.userName ?? 'Test User',
      email: overrides.userEmail ?? 'test@example.com',
      emailVerified: overrides.emailVerified ?? true,
      image: overrides.image ?? null,
      twoFactorEnabled: false,
    },
    session: {
      id: overrides.sessionId ?? 'session-123',
      createdAt: now,
      updatedAt: now,
      userId: overrides.userId ?? 'user-123',
      token: overrides.token ?? 'token-abc',
      expiresAt: overrides.expiresAt ?? new Date('2026-12-31'),
    },
  };
}

// Helper to create mock database with user record
function createMockDb(userRecord?: { role: string; locale: string } | null) {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(userRecord ? [userRecord] : []),
  };
}

describe('Server auth module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSessionFromHeaders', () => {
    it('should return null when no session exists', async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const result = await getSessionFromHeaders();

      expect(result).toBeNull();
      expect(auth.api.getSession).toHaveBeenCalled();
    });

    it('should return session with user data from database', async () => {
      const mockSession = createMockSession({
        userId: 'user-123',
        userName: 'Test User',
        userEmail: 'test@example.com',
        emailVerified: true,
        image: null,
      });

      const mockDb = createMockDb({ role: 'instructor', locale: 'id' });

      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);
      vi.mocked(getDb).mockReturnValue(mockDb as any);

      const result = await getSessionFromHeaders();

      expect(result).toEqual({
        user: {
          id: 'user-123',
          name: 'Test User',
          email: 'test@example.com',
          role: 'instructor',
          locale: 'id',
          emailVerified: true,
          image: null,
        },
        session: {
          id: 'session-123',
          token: 'token-abc',
          expiresAt: expect.any(Date),
        },
      });
    });

    it('should default to student role when user record not found', async () => {
      const mockSession = createMockSession({
        userId: 'user-456',
        userName: 'New User',
        userEmail: 'new@example.com',
        emailVerified: false,
        image: 'https://example.com/avatar.png',
      });

      const mockDb = createMockDb(null); // No user record found

      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);
      vi.mocked(getDb).mockReturnValue(mockDb as any);

      const result = await getSessionFromHeaders();

      expect(result).toEqual({
        user: {
          id: 'user-456',
          name: 'New User',
          email: 'new@example.com',
          role: 'student', // Default role
          locale: 'en', // Default locale
          emailVerified: false,
          image: 'https://example.com/avatar.png',
        },
        session: {
          id: 'session-123',
          token: 'token-abc',
          expiresAt: expect.any(Date),
        },
      });
    });

    it('should handle emailVerified as truthy value', async () => {
      const mockSession = createMockSession({
        userId: 'user-789',
        emailVerified: new Date() as any, // Truthy value
      });

      const mockDb = createMockDb({ role: 'admin', locale: 'en' });

      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);
      vi.mocked(getDb).mockReturnValue(mockDb as any);

      const result = await getSessionFromHeaders();

      expect(result?.user.emailVerified).toBe(true);
    });

    it('should query database with correct user id', async () => {
      const mockSession = createMockSession({
        userId: 'specific-user-id',
      });

      const mockWhere = vi.fn().mockResolvedValue([{ role: 'student', locale: 'en' }]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      const mockDb = { select: mockSelect };

      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);
      vi.mocked(getDb).mockReturnValue(mockDb as any);

      await getSessionFromHeaders();

      // Verify the query was constructed correctly
      expect(mockSelect).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    it('should throw redirect when no session exists', async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      await expect(requireRole(['admin'])).rejects.toThrow('REDIRECT: /auth/login');
    });

    it('should throw redirect when user does not have required role', async () => {
      const mockSession = createMockSession({
        userId: 'user-123',
        userName: 'Student User',
        userEmail: 'student@example.com',
      });

      const mockDb = createMockDb({ role: 'student', locale: 'en' });

      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);
      vi.mocked(getDb).mockReturnValue(mockDb as any);

      await expect(requireRole(['admin', 'instructor'])).rejects.toThrow(
        'REDIRECT: /student/dashboard',
      );
    });

    it('should return session when user has required role', async () => {
      const mockSession = createMockSession({
        userId: 'user-123',
        userName: 'Admin User',
        userEmail: 'admin@example.com',
      });

      const mockDb = createMockDb({ role: 'admin', locale: 'en' });

      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);
      vi.mocked(getDb).mockReturnValue(mockDb as any);

      const result = await requireRole(['admin']);

      expect(result).toBeDefined();
      expect(result?.user.role).toBe('admin');
      expect(result?.user.id).toBe('user-123');
    });

    it('should redirect to correct dashboard based on user role', async () => {
      const mockSession = createMockSession({
        userId: 'user-123',
        userName: 'Instructor User',
        userEmail: 'instructor@example.com',
      });

      const mockDb = createMockDb({ role: 'instructor', locale: 'en' });

      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);
      vi.mocked(getDb).mockReturnValue(mockDb as any);

      // Try to access admin-only route as instructor
      await expect(requireRole(['admin'])).rejects.toThrow('REDIRECT: /instructor/dashboard');
    });

    it('should accept multiple roles', async () => {
      const mockSession = createMockSession({
        userId: 'user-123',
        userName: 'Admin User',
        userEmail: 'admin@example.com',
      });

      const mockDb = createMockDb({ role: 'admin', locale: 'en' });

      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);
      vi.mocked(getDb).mockReturnValue(mockDb as any);

      // Should pass with multiple allowed roles
      const result = await requireRole(['superadmin', 'admin']);

      expect(result).toBeDefined();
      expect(result?.user.role).toBe('admin');
    });

    it('should throw redirect for superadmin when only student role allowed', async () => {
      const mockSession = createMockSession({
        userId: 'user-123',
        userName: 'Super Admin',
        userEmail: 'superadmin@example.com',
      });

      const mockDb = createMockDb({ role: 'superadmin', locale: 'en' });

      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);
      vi.mocked(getDb).mockReturnValue(mockDb as any);

      await expect(requireRole(['student'])).rejects.toThrow('REDIRECT: /admin/dashboard');
    });
  });
});
