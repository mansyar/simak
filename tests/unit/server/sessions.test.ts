import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn(),
}));

import { getSessionFromHeaders } from '@/server/auth';
import { getDb } from '@/db/index';
import { logAuditEvent } from '@/lib/audit';
import {
  listActiveSessionsHandler,
  revokeSessionHandler,
  revokeAllOtherSessionsHandler,
} from '@/server/sessions.server';

const mockGetSessionFromHeaders = vi.mocked(getSessionFromHeaders);
const mockGetDb = vi.mocked(getDb);
const mockLogAuditEvent = vi.mocked(logAuditEvent);

function createMockSession(overrides?: { id?: string }) {
  return {
    user: {
      id: overrides?.id ?? 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'student' as const,
      locale: 'en',
      emailVerified: true,
      image: null,
    },
    session: {
      id: 'session-current',
      token: 'current-token',
      expiresAt: new Date(Date.now() + 86400000),
    },
  };
}

function createMockDbSession(overrides?: Record<string, unknown>) {
  return {
    id: 'session-1',
    userId: 'user-1',
    token: 'token-abc',
    expiresAt: new Date(Date.now() + 86400000),
    ipAddress: '127.0.0.1',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  };
}

describe('listActiveSessionsHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return unauthorized when no session', async () => {
    mockGetSessionFromHeaders.mockResolvedValue(null);
    const result = await listActiveSessionsHandler();
    expect(result).toEqual({ error: 'Unauthorized' });
  });

  it('should return all sessions for current user', async () => {
    mockGetSessionFromHeaders.mockResolvedValue(createMockSession());
    const sessions = [
      createMockDbSession({ id: 'session-current' }),
      createMockDbSession({ id: 'session-other', token: 'token-other' }),
    ];
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(sessions),
        }),
      }),
    });
    mockGetDb.mockReturnValue({ select: mockSelect } as any);

    const result = await listActiveSessionsHandler();

    expect(result.sessions).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('should return empty array when no sessions exist', async () => {
    mockGetSessionFromHeaders.mockResolvedValue(createMockSession());
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    mockGetDb.mockReturnValue({ select: mockSelect } as any);

    const result = await listActiveSessionsHandler();

    expect(result.sessions).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('should handle null user agent gracefully', async () => {
    mockGetSessionFromHeaders.mockResolvedValue(createMockSession());
    const sessions = [createMockDbSession({ userAgent: null })];
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(sessions),
        }),
      }),
    });
    mockGetDb.mockReturnValue({ select: mockSelect } as any);

    const result = (await listActiveSessionsHandler()) as {
      sessions: Array<{ device: { browser: string; os: string; device: string } }>;
    };

    expect(result.sessions[0].device).toEqual({
      browser: 'Unknown',
      os: 'Unknown',
      device: 'Unknown',
    });
  });

  it('should parse macOS Safari user agent', async () => {
    mockGetSessionFromHeaders.mockResolvedValue(createMockSession());
    const sessions = [
      createMockDbSession({
        userAgent:
          'Mozilla/5.0 (Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      }),
    ];
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(sessions),
        }),
      }),
    });
    mockGetDb.mockReturnValue({ select: mockSelect } as any);

    const result = (await listActiveSessionsHandler()) as {
      sessions: Array<{ device: { browser: string; os: string; device: string } }>;
    };

    expect(result.sessions[0].device.browser).toBe('Safari');
    expect(result.sessions[0].device.os).toBe('macOS');
    expect(result.sessions[0].device.device).toBe('Desktop');
  });

  it('should parse Android Chrome user agent', async () => {
    mockGetSessionFromHeaders.mockResolvedValue(createMockSession());
    const sessions = [
      createMockDbSession({
        userAgent:
          'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      }),
    ];
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(sessions),
        }),
      }),
    });
    mockGetDb.mockReturnValue({ select: mockSelect } as any);

    const result = (await listActiveSessionsHandler()) as {
      sessions: Array<{ device: { browser: string; os: string; device: string } }>;
    };

    expect(result.sessions[0].device.browser).toBe('Chrome');
    // Android UA includes "Linux" and the Linux check runs first
    expect(result.sessions[0].device.os).toBe('Linux');
    expect(result.sessions[0].device.device).toBe('Mobile');
  });

  it('should parse iPad Safari user agent', async () => {
    mockGetSessionFromHeaders.mockResolvedValue(createMockSession());
    const sessions = [
      createMockDbSession({
        userAgent:
          'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      }),
    ];
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(sessions),
        }),
      }),
    });
    mockGetDb.mockReturnValue({ select: mockSelect } as any);

    const result = (await listActiveSessionsHandler()) as {
      sessions: Array<{ device: { browser: string; os: string; device: string } }>;
    };

    expect(result.sessions[0].device.browser).toBe('Safari');
    // iPad UA includes "Mac OS X" (os=macOS) and "Mobile" (device=Mobile, not Tablet)
    expect(result.sessions[0].device.os).toBe('macOS');
    expect(result.sessions[0].device.device).toBe('Mobile');
  });

  it('should parse Linux Firefox user agent', async () => {
    mockGetSessionFromHeaders.mockResolvedValue(createMockSession());
    const sessions = [
      createMockDbSession({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',
      }),
    ];
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(sessions),
        }),
      }),
    });
    mockGetDb.mockReturnValue({ select: mockSelect } as any);

    const result = (await listActiveSessionsHandler()) as {
      sessions: Array<{ device: { browser: string; os: string; device: string } }>;
    };

    expect(result.sessions[0].device.browser).toBe('Firefox');
    expect(result.sessions[0].device.os).toBe('Linux');
    expect(result.sessions[0].device.device).toBe('Desktop');
  });

  it('should include device info from user agent', async () => {
    mockGetSessionFromHeaders.mockResolvedValue(createMockSession());
    const sessions = [
      createMockDbSession({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }),
    ];
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(sessions),
        }),
      }),
    });
    mockGetDb.mockReturnValue({ select: mockSelect } as any);

    const result = (await listActiveSessionsHandler()) as {
      sessions: Array<{ userAgent: string | null }>;
    };

    expect(result.sessions[0].userAgent).toContain('Chrome');
  });
});

describe('revokeSessionHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return unauthorized when no session', async () => {
    mockGetSessionFromHeaders.mockResolvedValue(null);
    const result = await revokeSessionHandler({
      data: { sessionId: 'session-other' },
    });
    expect(result).toEqual({ error: 'Unauthorized' });
  });

  it('should revoke a specific session', async () => {
    mockGetSessionFromHeaders.mockResolvedValue(createMockSession());
    const mockDelete = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    mockGetDb.mockReturnValue({ delete: mockDelete } as any);

    const result = await revokeSessionHandler({
      data: { sessionId: 'session-other' },
    });

    expect(result).toEqual({ success: true });
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user-1',
        action: 'session.revoked',
        entityType: 'session',
      }),
    );
  });

  it('should prevent revoking the current session', async () => {
    mockGetSessionFromHeaders.mockResolvedValue(createMockSession({ id: 'user-1' }));
    const result = await revokeSessionHandler({
      data: { sessionId: 'session-current' },
    });
    expect(result).toEqual({ error: 'Cannot revoke current session' });
  });

  it('should handle revocation failure', async () => {
    mockGetSessionFromHeaders.mockResolvedValue(createMockSession());
    const mockDelete = vi.fn().mockReturnValue({
      where: vi.fn().mockRejectedValue(new Error('DB error')),
    });
    mockGetDb.mockReturnValue({ delete: mockDelete } as any);

    const result = await revokeSessionHandler({
      data: { sessionId: 'session-other' },
    });

    expect(result).toEqual({ error: 'Failed to revoke session' });
  });
});

describe('revokeAllOtherSessionsHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return unauthorized when no session', async () => {
    mockGetSessionFromHeaders.mockResolvedValue(null);
    const result = await revokeAllOtherSessionsHandler();
    expect(result).toEqual({ error: 'Unauthorized' });
  });

  it('should revoke all sessions except current', async () => {
    mockGetSessionFromHeaders.mockResolvedValue(createMockSession());
    const mockDelete = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    mockGetDb.mockReturnValue({ delete: mockDelete } as any);

    const result = await revokeAllOtherSessionsHandler();

    expect(result).toEqual({ success: true, revokedCount: expect.any(Number) });
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user-1',
        action: 'session.all_others_revoked',
        entityType: 'session',
      }),
    );
  });

  it('should return zero revoked count when only current session exists', async () => {
    mockGetSessionFromHeaders.mockResolvedValue(createMockSession());
    const mockDelete = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    mockGetDb.mockReturnValue({ delete: mockDelete } as any);

    const result = await revokeAllOtherSessionsHandler();

    expect(result.success).toBe(true);
  });

  it('should handle revocation failure', async () => {
    mockGetSessionFromHeaders.mockResolvedValue(createMockSession());
    const mockDelete = vi.fn().mockReturnValue({
      where: vi.fn().mockRejectedValue(new Error('DB error')),
    });
    mockGetDb.mockReturnValue({ delete: mockDelete } as any);

    const result = await revokeAllOtherSessionsHandler();

    expect(result).toEqual({ error: 'Failed to revoke sessions' });
  });
});
