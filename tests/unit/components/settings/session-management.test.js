import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionManagement } from '@/components/settings/SessionManagement';
const {
  mockListActiveSessions,
  mockRevokeSession,
  mockRevokeAllOtherSessions,
  mockInvalidateQueries,
  mockUseQuery,
  capturedMutationConfigs,
} = vi.hoisted(() => ({
  mockListActiveSessions: vi.fn(),
  mockRevokeSession: vi.fn(),
  mockRevokeAllOtherSessions: vi.fn(),
  mockInvalidateQueries: vi.fn(),
  mockUseQuery: vi.fn(),
  capturedMutationConfigs: [],
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: mockUseQuery,
  useMutation: (config) => {
    capturedMutationConfigs.push(config);
    const myIndex = capturedMutationConfigs.length - 1;
    return {
      mutate: (...args) => {
        const myConfig = capturedMutationConfigs[myIndex];
        const mutationFn = myConfig?.mutationFn;
        if (mutationFn) {
          return Promise.resolve(mutationFn(...args)).then(
            (result) => {
              myConfig?.onSuccess?.(result);
              return result;
            },
            (err) => {
              myConfig?.onError?.(err);
              throw err;
            },
          );
        }
      },
      isPending: false,
      mutateAsync: vi.fn(),
    };
  },
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));
vi.mock('@/server/sessions', () => ({
  listActiveSessions: mockListActiveSessions,
  revokeSession: mockRevokeSession,
  revokeAllOtherSessions: mockRevokeAllOtherSessions,
}));
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key, params) => {
      const translations = {
        'settings.sessions.title': 'Active Sessions',
        'settings.sessions.description': 'Manage your active login sessions',
        'settings.sessions.noSessions': 'No active sessions found.',
        'settings.sessions.current': 'Current',
        'settings.sessions.revokeAllOthers': 'Revoke All Other Sessions',
        'settings.sessions.revokeTitle': 'Revoke Session',
        'settings.sessions.revokeDescription': 'Are you sure you want to revoke this session?',
        'settings.sessions.revokeAllTitle': 'Revoke All Other Sessions',
        'settings.sessions.revokeAllDescription': 'This will revoke {{count}} sessions',
        'settings.sessions.revoke': 'Revoke',
        'settings.sessions.revokeAll': 'Revoke All',
        'common.cancel': 'Cancel',
      };
      if (params) {
        const value = translations[key] || key;
        return value.replace('{{count}}', params.count ?? '');
      }
      return translations[key] || key;
    },
  }),
}));
vi.mock('lucide-react', () => ({
  Monitor: () => _jsx('span', { children: 'Monitor' }),
  Smartphone: () => _jsx('span', { children: 'Smartphone' }),
  Tablet: () => _jsx('span', { children: 'Tablet' }),
  RefreshCw: () => _jsx('span', { children: 'Loading...' }),
  LogOut: () => _jsx('span', { children: 'Revoke' }),
  LogOutIcon: () => _jsx('span', { children: 'RevokeAll' }),
  XIcon: () => _jsx('span', { children: 'X' }),
}));
const mockSessions = [
  {
    id: 'session-1',
    isCurrent: true,
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    device: { browser: 'Chrome', os: 'Windows', device: 'Desktop' },
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-01-15'),
  },
  {
    id: 'session-2',
    isCurrent: false,
    ipAddress: '10.0.0.1',
    userAgent: 'Mozilla/5.0',
    device: { browser: 'Safari', os: 'iOS', device: 'Mobile' },
    createdAt: new Date('2025-01-14'),
    updatedAt: new Date('2025-01-14'),
  },
];
describe('SessionManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedMutationConfigs.length = 0;
  });
  // ---------- 1. Loading State ----------
  it('should show loading spinner when isLoading is true', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(_jsx(SessionManagement, {}));
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeDefined();
  });
  // ---------- 2. Empty State ----------
  it('should show "No active sessions found" when sessions array is empty', () => {
    mockUseQuery.mockReturnValue({ data: { sessions: [], total: 0 }, isLoading: false });
    render(_jsx(SessionManagement, {}));
    expect(screen.getByText('No active sessions found.')).toBeDefined();
  });
  // ---------- 3. Renders sessions list ----------
  it('should render all sessions with browser and OS info', () => {
    mockUseQuery.mockReturnValue({ data: { sessions: mockSessions, total: 2 }, isLoading: false });
    render(_jsx(SessionManagement, {}));
    expect(screen.getByText('Chrome on Windows')).toBeDefined();
    expect(screen.getByText('Safari on iOS')).toBeDefined();
  });
  // ---------- 4. DeviceIcon renders correct icons ----------
  it('should render Smartphone for Mobile, Tablet for Tablet, Monitor for Desktop', () => {
    const sessions = [
      { ...mockSessions[0], device: { browser: 'Chrome', os: 'Windows', device: 'Mobile' } },
      {
        ...mockSessions[0],
        id: 's2',
        device: { browser: 'Chrome', os: 'Android', device: 'Tablet' },
      },
      {
        ...mockSessions[0],
        id: 's3',
        device: { browser: 'Firefox', os: 'Linux', device: 'Desktop' },
      },
    ];
    mockUseQuery.mockReturnValue({ data: { sessions, total: 3 }, isLoading: false });
    render(_jsx(SessionManagement, {}));
    expect(screen.getByText('Smartphone')).toBeDefined();
    expect(screen.getByText('Tablet')).toBeDefined();
    const monitorElements = screen.getAllByText('Monitor');
    expect(monitorElements.length).toBeGreaterThanOrEqual(1);
  });
  // ---------- 5. Current session badge ----------
  it('should show "Current" badge for the current session', () => {
    mockUseQuery.mockReturnValue({ data: { sessions: mockSessions, total: 2 }, isLoading: false });
    render(_jsx(SessionManagement, {}));
    expect(screen.getByText('Current')).toBeDefined();
  });
  // ---------- 6. Revoke button only for non-current ----------
  it('should show revoke button only for non-current sessions', () => {
    mockUseQuery.mockReturnValue({ data: { sessions: mockSessions, total: 2 }, isLoading: false });
    render(_jsx(SessionManagement, {}));
    const revokeButtons = screen.getAllByText('Revoke');
    expect(revokeButtons.length).toBe(1);
  });
  // ---------- 7. Revoke All Others button shown ----------
  it('should show "Revoke All Other Sessions" button when other sessions exist', () => {
    mockUseQuery.mockReturnValue({ data: { sessions: mockSessions, total: 2 }, isLoading: false });
    render(_jsx(SessionManagement, {}));
    expect(screen.getByText('Revoke All Other Sessions')).toBeDefined();
  });
  // ---------- 8. Revoke All Others hidden ----------
  it('should hide "Revoke All Other Sessions" button when no other sessions', () => {
    const singleSession = [mockSessions[0]];
    mockUseQuery.mockReturnValue({ data: { sessions: singleSession, total: 1 }, isLoading: false });
    render(_jsx(SessionManagement, {}));
    expect(screen.queryByText('Revoke All Other Sessions')).toBeNull();
  });
  // ---------- 9. Open revoke single dialog ----------
  it('should open revoke dialog with device info when revoke button is clicked', () => {
    mockUseQuery.mockReturnValue({ data: { sessions: mockSessions, total: 2 }, isLoading: false });
    render(_jsx(SessionManagement, {}));
    fireEvent.click(screen.getByText('Revoke'));
    expect(screen.getByText('Revoke Session')).toBeDefined();
    expect(screen.getByText('Safari on iOS · 10.0.0.1')).toBeDefined();
  });
  // ---------- 10. Execute revoke mutation ----------
  it('should call revokeSession and invalidate queries on revoke', async () => {
    mockRevokeSession.mockResolvedValue({ success: true });
    mockUseQuery.mockReturnValue({ data: { sessions: mockSessions, total: 2 }, isLoading: false });
    render(_jsx(SessionManagement, {}));
    fireEvent.click(screen.getByText('Revoke'));
    const revokeBtn = screen.getAllByText('Revoke');
    fireEvent.click(revokeBtn[revokeBtn.length - 1]);
    await vi.waitFor(() => {
      expect(mockRevokeSession).toHaveBeenCalledWith({ data: { sessionId: 'session-2' } });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['activeSessions'] });
    });
  });
  // ---------- 11. Close revoke dialog via Cancel ----------
  it('should close revoke dialog when Cancel is clicked', () => {
    mockUseQuery.mockReturnValue({ data: { sessions: mockSessions, total: 2 }, isLoading: false });
    render(_jsx(SessionManagement, {}));
    fireEvent.click(screen.getByText('Revoke'));
    expect(screen.getByText('Revoke Session')).toBeDefined();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Revoke Session')).toBeNull();
  });
  // ---------- 12. Open revoke all dialog ----------
  it('should open revoke all dialog with session count when clicked', () => {
    mockUseQuery.mockReturnValue({ data: { sessions: mockSessions, total: 2 }, isLoading: false });
    render(_jsx(SessionManagement, {}));
    fireEvent.click(screen.getByText('Revoke All Other Sessions'));
    const matches = screen.getAllByText('Revoke All Other Sessions');
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('This will revoke 1 sessions')).toBeDefined();
  });
  // ---------- 13. Execute revoke all mutation ----------
  it('should call revokeAllOtherSessions and invalidate queries on revoke all', async () => {
    mockRevokeAllOtherSessions.mockResolvedValue({ success: true, revokedCount: 1 });
    mockUseQuery.mockReturnValue({ data: { sessions: mockSessions, total: 2 }, isLoading: false });
    render(_jsx(SessionManagement, {}));
    fireEvent.click(screen.getByText('Revoke All Other Sessions'));
    fireEvent.click(screen.getByText('Revoke All'));
    await vi.waitFor(() => {
      expect(mockRevokeAllOtherSessions).toHaveBeenCalledOnce();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['activeSessions'] });
    });
  });
  // ---------- 14. Close revoke all dialog via Cancel ----------
  it('should close revoke all dialog when Cancel is clicked', () => {
    mockUseQuery.mockReturnValue({ data: { sessions: mockSessions, total: 2 }, isLoading: false });
    render(_jsx(SessionManagement, {}));
    fireEvent.click(screen.getByText('Revoke All Other Sessions'));
    expect(screen.getByText('This will revoke 1 sessions')).toBeDefined();
    const cancelButtons = screen.getAllByText('Cancel');
    fireEvent.click(cancelButtons[0]);
    expect(screen.queryByText('Revoke All')).toBeNull();
  });
});
