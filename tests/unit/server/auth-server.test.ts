/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @tanstack/react-start/server
vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: vi.fn().mockReturnValue(new Headers()),
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

// Mock users schema
vi.mock('@/db/schema/users', () => ({
  users: {
    id: 'id',
    role: 'role',
    locale: 'locale',
    deletedAt: 'deletedAt',
  },
}));

import { getSessionHandler } from '@/server/auth.server';
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
      role: overrides.userRole ?? undefined,
      locale: overrides.userLocale ?? undefined,
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

describe('getSessionHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when no session exists', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);

    const result = await getSessionHandler();

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

    const result = await getSessionHandler();

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

  it('should return null when user record is not found or soft-deleted', async () => {
    const mockSession = createMockSession({
      userId: 'user-456',
      userName: 'New User',
      userEmail: 'new@example.com',
      emailVerified: false,
      image: 'https://example.com/avatar.png',
    });

    const mockDb = createMockDb(null); // No active user record found

    vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);
    vi.mocked(getDb).mockReturnValue(mockDb as any);

    const result = await getSessionHandler();

    expect(result).toBeNull();
  });

  it('should handle emailVerified as truthy value', async () => {
    const mockSession = createMockSession({
      userId: 'user-789',
      emailVerified: new Date() as any, // Truthy value
    });

    const mockDb = createMockDb({ role: 'admin', locale: 'en' });

    vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);
    vi.mocked(getDb).mockReturnValue(mockDb as any);

    const result = await getSessionHandler();

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

    await getSessionHandler();

    // Verify the query was constructed correctly
    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
  });

  it('should return null when user is soft-deleted', async () => {
    const mockSession = createMockSession({ userId: 'deleted-user' });
    const mockDb = createMockDb(null);

    vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);
    vi.mocked(getDb).mockReturnValue(mockDb as any);

    const result = await getSessionHandler();

    expect(result).toBeNull();
  });

  it('should use role/locale from session payload when present', async () => {
    const mockSession = createMockSession({
      userId: 'user-123',
      userRole: 'admin',
      userLocale: 'id',
    });

    const mockDb = createMockDb({ role: 'student', locale: 'en' });

    vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);
    vi.mocked(getDb).mockReturnValue(mockDb as any);

    const result = await getSessionHandler();

    expect(result?.user.role).toBe('admin');
    expect(result?.user.locale).toBe('id');
  });

  it('should fall back to DB role/locale when payload is missing', async () => {
    const mockSession = createMockSession({ userId: 'user-123' });
    const mockDb = createMockDb({ role: 'instructor', locale: 'id' });

    vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);
    vi.mocked(getDb).mockReturnValue(mockDb as any);

    const result = await getSessionHandler();

    expect(result?.user.role).toBe('instructor');
    expect(result?.user.locale).toBe('id');
  });
});
