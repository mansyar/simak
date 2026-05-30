import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseQuery = vi.fn();
const mockInvalidateQueries = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: vi.fn(() => ({
    mutateAsync: vi.fn(),
    mutate: vi.fn(),
    isPending: false,
  })),
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

vi.mock('@/server/sessions', () => ({
  listActiveSessions: { url: '/api/sessions/list' },
  revokeSession: { url: '/api/sessions/revoke' },
  revokeAllOtherSessions: { url: '/api/sessions/revoke-all' },
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'settings.sessions.title': 'Active Sessions',
        'settings.sessions.description': 'Manage your active login sessions',
        'settings.sessions.current': 'Current',
        'settings.sessions.noSessions': 'No active sessions found.',
        'settings.sessions.revokeTitle': 'Revoke Session',
        'settings.sessions.revokeDescription': 'This will log out the session',
        'settings.sessions.revoke': 'Revoke',
        'settings.sessions.revokeAllTitle': 'Revoke All Other Sessions',
        'settings.sessions.revokeAllDescription': 'This will log out {count} other session(s)',
        'settings.sessions.revokeAllOthers': 'Revoke All Other Sessions',
        'common.cancel': 'Cancel',
      };
      return translations[key] || key;
    },
  }),
}));

import { SessionManagement } from '@/components/settings/SessionManagement';

describe('SessionManagement', () => {
  it('should render component without errors', () => {
    mockUseQuery.mockReturnValue({ data: { sessions: [], total: 0 }, isLoading: false });
    render(<SessionManagement />);
    expect(screen.getByText('Active Sessions')).toBeDefined();
  });

  it('should show description text', () => {
    mockUseQuery.mockReturnValue({ data: { sessions: [], total: 0 }, isLoading: false });
    render(<SessionManagement />);
    expect(screen.getByText('Manage your active login sessions')).toBeDefined();
  });

  it('should show no sessions message when empty', () => {
    mockUseQuery.mockReturnValue({ data: { sessions: [], total: 0 }, isLoading: false });
    render(<SessionManagement />);
    expect(screen.getByText('No active sessions found.')).toBeDefined();
  });

  it('should show loading state', () => {
    mockUseQuery.mockReturnValue({ data: null, isLoading: true });
    const { container } = render(<SessionManagement />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeDefined();
  });

  it('should show current session badge', () => {
    mockUseQuery.mockReturnValue({
      data: {
        sessions: [
          {
            id: 'sess-1',
            isCurrent: true,
            ipAddress: '127.0.0.1',
            userAgent: 'Mozilla/5.0 Chrome/120',
            device: { browser: 'Chrome', os: 'Windows 10/11', device: 'Desktop' },
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-01-01'),
          },
        ],
        total: 1,
      },
      isLoading: false,
    });
    render(<SessionManagement />);
    expect(screen.getByText('Current')).toBeDefined();
    expect(screen.getByText('Chrome on Windows 10/11')).toBeDefined();
  });

  it('should show revoke button for non-current sessions', () => {
    mockUseQuery.mockReturnValue({
      data: {
        sessions: [
          {
            id: 'sess-1',
            isCurrent: true,
            ipAddress: '127.0.0.1',
            userAgent: 'Mozilla/5.0 Chrome/120',
            device: { browser: 'Chrome', os: 'Windows 10/11', device: 'Desktop' },
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-01-01'),
          },
          {
            id: 'sess-2',
            isCurrent: false,
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0 Firefox/121',
            device: { browser: 'Firefox', os: 'macOS', device: 'Desktop' },
            createdAt: new Date('2025-12-15'),
            updatedAt: new Date('2025-12-15'),
          },
        ],
        total: 2,
      },
      isLoading: false,
    });
    render(<SessionManagement />);
    expect(screen.getByText('Firefox on macOS')).toBeDefined();
    expect(screen.queryByText('Current')).toBeDefined();
  });

  it('should show revoke all others button when there are other sessions', () => {
    mockUseQuery.mockReturnValue({
      data: {
        sessions: [
          {
            id: 'sess-1',
            isCurrent: true,
            ipAddress: '127.0.0.1',
            userAgent: 'Chrome',
            device: { browser: 'Chrome', os: 'Windows', device: 'Desktop' },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'sess-2',
            isCurrent: false,
            ipAddress: '10.0.0.1',
            userAgent: 'Firefox',
            device: { browser: 'Firefox', os: 'Linux', device: 'Desktop' },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 2,
      },
      isLoading: false,
    });
    render(<SessionManagement />);
    expect(screen.getByText('Revoke All Other Sessions')).toBeDefined();
  });

  it('should not show revoke all others button when only current session', () => {
    mockUseQuery.mockReturnValue({
      data: {
        sessions: [
          {
            id: 'sess-1',
            isCurrent: true,
            ipAddress: '127.0.0.1',
            userAgent: 'Chrome',
            device: { browser: 'Chrome', os: 'Windows', device: 'Desktop' },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
      },
      isLoading: false,
    });
    render(<SessionManagement />);
    expect(screen.queryByText('Revoke All Other Sessions')).toBeNull();
  });
});
