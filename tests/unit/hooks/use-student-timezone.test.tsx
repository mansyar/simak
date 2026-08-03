import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type React from 'react';
import { getCurrentUser } from '@/server/settings';
import { StudentTimezoneProvider, useStudentTimezone } from '@/hooks/use-student-timezone';

vi.mock('@/server/settings', () => ({
  getCurrentUser: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <StudentTimezoneProvider>{children}</StudentTimezoneProvider>
    </QueryClientProvider>
  );
}

describe('useStudentTimezone', () => {
  let resolvedOptionsSpy: ReturnType<typeof vi.spyOn>;
  const user = { id: 'student-1', name: 'Student', email: 'student@example.com', image: null };

  beforeEach(() => {
    vi.clearAllMocks();
    resolvedOptionsSpy = vi
      .spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
      .mockReturnValue({
        locale: 'en-US',
        calendar: 'gregory',
        numberingSystem: 'latn',
        timeZone: 'America/Los_Angeles',
      });
  });

  afterEach(() => {
    resolvedOptionsSpy.mockRestore();
  });

  it('uses a saved valid timezone after the settings query resolves', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      user,
      settings: { reducedMotion: false, timezone: 'Asia/Tokyo' },
    });

    const { result } = renderHook(() => useStudentTimezone(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.timezone).toBe('Asia/Tokyo');
  });

  it('detects and exposes the browser timezone when no saved preference exists', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      user,
      settings: { reducedMotion: false },
    });

    const { result } = renderHook(() => useStudentTimezone(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.timezone).toBe('America/Los_Angeles');
  });

  it('falls back to UTC for an invalid saved value or browser timezone', async () => {
    resolvedOptionsSpy.mockReturnValue({
      locale: 'en-US',
      calendar: 'gregory',
      numberingSystem: 'latn',
      timeZone: 'Mars/Phobos',
    });
    vi.mocked(getCurrentUser).mockResolvedValue({
      user,
      settings: { reducedMotion: false, timezone: 'Mars/Phobos' },
    });

    const { result } = renderHook(() => useStudentTimezone(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.timezone).toBe('UTC');
  });
});
