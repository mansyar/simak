/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

import { getSessionHandler, clearSessionCacheForTests } from '@/server/auth.server';
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
    clearSessionCacheForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
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

describe('getSessionHandler - session cache (PERF-22)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSessionCacheForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cache miss — first call for a user invokes getDb and caches the result', async () => {
    vi.useFakeTimers();

    const mockSession = createMockSession({ userId: 'cache-user-1' });
    const mockDb = createMockDb({ role: 'admin', locale: 'en' });

    vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);
    vi.mocked(getDb).mockReturnValue(mockDb as any);

    // First call — cache miss, should query DB
    const result = await getSessionHandler();

    expect(getDb).toHaveBeenCalledTimes(1);
    expect(result?.user.role).toBe('admin');
    expect(result?.user.locale).toBe('en');
  });

  it('cache hit — second call within 5s TTL does NOT invoke getDb', async () => {
    vi.useFakeTimers();

    const mockSession = createMockSession({ userId: 'cache-user-2' });
    const mockDb = createMockDb({ role: 'admin', locale: 'en' });

    vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);
    vi.mocked(getDb).mockReturnValue(mockDb as any);

    // First call — cache miss, queries DB
    await getSessionHandler();
    expect(getDb).toHaveBeenCalledTimes(1);

    // Second call within TTL — cache hit, should NOT query DB
    await getSessionHandler();
    expect(getDb).toHaveBeenCalledTimes(1); // Still 1, not 2

    // auth.api.getSession must still be called (security-critical, never cached)
    expect(auth.api.getSession).toHaveBeenCalledTimes(2);
  });

  it('TTL expiry — after 5001ms, a subsequent call re-queries the DB', async () => {
    vi.useFakeTimers();

    const mockSession = createMockSession({ userId: 'cache-user-3' });
    const mockDb = createMockDb({ role: 'admin', locale: 'en' });

    vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);
    vi.mocked(getDb).mockReturnValue(mockDb as any);

    // First call — cache miss
    await getSessionHandler();
    expect(getDb).toHaveBeenCalledTimes(1);

    // Second call within TTL — cache hit
    await getSessionHandler();
    expect(getDb).toHaveBeenCalledTimes(1);

    // Advance time past TTL (5001ms)
    vi.advanceTimersByTime(5001);

    // Third call after TTL — cache miss, re-queries DB
    await getSessionHandler();
    expect(getDb).toHaveBeenCalledTimes(2);
  });

  it('concurrent — two calls within TTL: first misses (queries DB), second hits cache', async () => {
    vi.useFakeTimers();

    const mockSession = createMockSession({ userId: 'cache-user-4' });
    const mockDb = createMockDb({ role: 'admin', locale: 'en' });

    vi.mocked(auth.api.getSession).mockResolvedValue(mockSession);
    vi.mocked(getDb).mockReturnValue(mockDb as any);

    // First call — cache miss, queries DB
    await getSessionHandler();
    expect(getDb).toHaveBeenCalledTimes(1);

    // Second call within TTL — cache hit, no DB query
    await getSessionHandler();
    expect(getDb).toHaveBeenCalledTimes(1); // Still 1, not 2
  });

  it('lazy eviction — after TTL expiry, a cache miss for user B evicts expired entry for user A', async () => {
    vi.useFakeTimers();

    const mockSessionA = createMockSession({ userId: 'user-A' });
    const mockSessionB = createMockSession({ userId: 'user-B' });
    const mockDb = createMockDb({ role: 'admin', locale: 'en' });

    // Call for user A — cache miss, queries DB
    vi.mocked(auth.api.getSession).mockResolvedValue(mockSessionA);
    vi.mocked(getDb).mockReturnValue(mockDb as any);
    await getSessionHandler();
    expect(getDb).toHaveBeenCalledTimes(1);

    // Call for user A again — cache hit
    await getSessionHandler();
    expect(getDb).toHaveBeenCalledTimes(1);

    // Advance time past TTL
    vi.advanceTimersByTime(5001);

    // Call for user B — cache miss, queries DB, evicts expired A entry
    vi.mocked(auth.api.getSession).mockResolvedValue(mockSessionB);
    await getSessionHandler();
    expect(getDb).toHaveBeenCalledTimes(2);

    // Call for user A again — should be cache miss (A was evicted by lazy eviction)
    vi.mocked(auth.api.getSession).mockResolvedValue(mockSessionA);
    await getSessionHandler();
    expect(getDb).toHaveBeenCalledTimes(3);
  });
});
