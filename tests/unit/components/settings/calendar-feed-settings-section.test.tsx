import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const queryState = vi.hoisted(() => ({
  data: undefined as { enabled: boolean } | undefined,
  isLoading: false,
  isError: false,
}));
const mutationResults = vi.hoisted(
  () => [] as { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean }[],
);
const mockUseQuery = vi.hoisted(() => vi.fn());
const mockUseMutation = vi.hoisted(() => vi.fn());
const mockInvalidateQueries = vi.hoisted(() => vi.fn());
const enableCalendarFeed = vi.hoisted(() => vi.fn());
const regenerateCalendarFeed = vi.hoisted(() => vi.fn());
const revokeCalendarFeed = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));
vi.mock('@/server/calendar-feed', () => ({
  enableCalendarFeed,
  getCalendarFeedStatus: vi.fn(),
  regenerateCalendarFeed,
  revokeCalendarFeed,
}));
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) =>
      ({
        'settings.calendarFeed.title': 'Calendar feed',
        'settings.calendarFeed.description': 'Subscribe to your student deadlines.',
        'settings.calendarFeed.loading': 'Loading calendar feed…',
        'settings.calendarFeed.enable': 'Enable calendar feed',
        'settings.calendarFeed.enabled': 'Calendar feed enabled',
        'settings.calendarFeed.empty': 'No subscription URL is currently shown.',
        'settings.calendarFeed.urlLabel': 'Private calendar URL',
        'settings.calendarFeed.copy': 'Copy URL',
        'settings.calendarFeed.copied': 'Calendar URL copied.',
        'settings.calendarFeed.copyError': 'Unable to copy calendar URL.',
        'settings.calendarFeed.regenerate': 'Regenerate URL',
        'settings.calendarFeed.revoke': 'Disable calendar feed',
        'settings.calendarFeed.confirmRegenerate': 'Regenerate the private calendar URL?',
        'settings.calendarFeed.confirmRevoke': 'Disable the private calendar feed?',
        'settings.calendarFeed.regenerated': 'Calendar URL regenerated.',
        'settings.calendarFeed.revoked': 'Calendar feed disabled.',
        'settings.calendarFeed.error': 'Calendar feed unavailable.',
      })[key] ?? key,
  }),
}));

import { CalendarFeedSettingsSection } from '@/components/settings/CalendarFeedSettingsSection';

function configureMutations() {
  const enable = vi.fn();
  const regenerate = vi.fn();
  const revoke = vi.fn();
  mutationResults.push(
    { mutateAsync: enable, isPending: false },
    { mutateAsync: regenerate, isPending: false },
    { mutateAsync: revoke, isPending: false },
  );
  return { enable, regenerate, revoke };
}

describe('CalendarFeedSettingsSection', () => {
  beforeEach(() => {
    queryState.data = undefined;
    queryState.isLoading = false;
    queryState.isError = false;
    mutationResults.length = 0;
    mockUseQuery.mockReset();
    mockUseMutation.mockReset();
    mockUseQuery.mockReturnValue(queryState);
    mockUseMutation.mockImplementation(() => {
      const index = (mockUseMutation.mock.calls.length - 1) % 3;
      return mutationResults[index] ?? { mutateAsync: vi.fn(), isPending: false };
    });
    mockInvalidateQueries.mockReset();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn() },
    });
  });

  it('renders a translated loading state', () => {
    queryState.isLoading = true;
    render(<CalendarFeedSettingsSection />);

    expect(screen.getByText('Loading calendar feed…')).toBeDefined();
  });

  it('enables a disabled feed and exposes the returned URL for copying', async () => {
    queryState.data = { enabled: false };
    const { enable } = configureMutations();
    enable.mockResolvedValue({
      enabled: true,
      feedUrl: 'https://simak.test/api/calendar/ics?token=opaque',
    });
    render(<CalendarFeedSettingsSection />);

    fireEvent.click(screen.getByRole('button', { name: 'Enable calendar feed' }));
    await waitFor(() => expect(enable).toHaveBeenCalledWith({ data: {} }));
    expect(screen.getByDisplayValue(/token=opaque/)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Copy URL' }));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'https://simak.test/api/calendar/ics?token=opaque',
      ),
    );
    expect(screen.getByText('Calendar URL copied.')).toBeDefined();
  });

  it('shows the enabled empty state and regenerates only after confirmation', async () => {
    queryState.data = { enabled: true };
    const { regenerate } = configureMutations();
    regenerate.mockResolvedValue({
      enabled: true,
      feedUrl: 'https://simak.test/api/calendar/ics?token=new',
    });
    render(<CalendarFeedSettingsSection />);

    expect(screen.getByText('No subscription URL is currently shown.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate URL' }));
    await waitFor(() => expect(regenerate).toHaveBeenCalledWith({ data: {} }));
    expect(window.confirm).toHaveBeenCalledWith('Regenerate the private calendar URL?');
    expect(screen.getByDisplayValue(/token=new/)).toBeDefined();
  });

  it('revokes an enabled feed after confirmation and invalidates status', async () => {
    queryState.data = { enabled: true };
    const { revoke } = configureMutations();
    revoke.mockResolvedValue({ enabled: false });
    render(<CalendarFeedSettingsSection />);

    fireEvent.click(screen.getByRole('button', { name: 'Disable calendar feed' }));
    await waitFor(() => expect(revoke).toHaveBeenCalledWith({ data: {} }));
    expect(window.confirm).toHaveBeenCalledWith('Disable the private calendar feed?');
    expect(screen.getByText('Calendar feed disabled.')).toBeDefined();
    expect(mockInvalidateQueries).toHaveBeenCalled();
  });

  it('reports mutation failures accessibly without exposing a credential', async () => {
    queryState.data = { enabled: false };
    const { enable } = configureMutations();
    enable.mockRejectedValue(new Error('token=secret'));
    render(<CalendarFeedSettingsSection />);

    fireEvent.click(screen.getByRole('button', { name: 'Enable calendar feed' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
    expect(screen.getByRole('alert').textContent).toContain('Calendar feed unavailable.');
    expect(screen.getByRole('alert').textContent).not.toContain('token=secret');
  });
});
