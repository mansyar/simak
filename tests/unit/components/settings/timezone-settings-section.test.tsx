import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TimezoneSettingsSection } from '@/components/settings/TimezoneSettingsSection';

const { mockUseEffect, mockUseQuery, mockUseMutation, mockMutateAsync, mockT } = vi.hoisted(() => ({
  mockUseEffect: vi.fn(),
  mockUseQuery: vi.fn(),
  mockUseMutation: vi.fn(),
  mockMutateAsync: vi.fn(),
  mockT: vi.fn((key: string) => key),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useEffect: (...args: unknown[]) => mockUseEffect(...args),
  };
});

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/server/settings', () => ({
  getCurrentUser: vi.fn(),
  updateUserSettings: vi.fn(),
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({ t: mockT, locale: 'en' as const }),
}));

describe('TimezoneSettingsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseEffect.mockImplementation((effect: () => void) => {
      queueMicrotask(effect);
    });
    mockUseMutation.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false });
    mockMutateAsync.mockResolvedValue({ timezone: 'Asia/Jakarta' });
    mockUseQuery.mockReturnValue({
      data: {
        settings: { reducedMotion: false },
      },
      isLoading: false,
    });
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      locale: 'en-US',
      calendar: 'gregory',
      numberingSystem: 'latn',
      timeZone: 'Asia/Jakarta',
    });
  });

  it('renders a neutral placeholder before browser timezone detection', () => {
    mockUseEffect.mockImplementation(() => undefined);

    render(<TimezoneSettingsSection />);

    expect(screen.getByText('settings.timezone.detecting')).toBeDefined();
    expect(screen.getByLabelText('settings.timezone.label')).toBeDefined();
  });

  it('persists the detected browser timezone after hydration', async () => {
    render(<TimezoneSettingsSection />);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ timezone: 'Asia/Jakarta' });
    });
    expect((screen.getByLabelText('settings.timezone.label') as HTMLInputElement).value).toBe(
      'Asia/Jakarta',
    );
  });

  it('supports a manually selected valid IANA timezone', async () => {
    mockUseQuery.mockReturnValue({
      data: { settings: { timezone: 'UTC' } },
      isLoading: false,
    });
    render(<TimezoneSettingsSection />);

    const input = screen.getByLabelText('settings.timezone.label');
    await waitFor(() => expect((input as HTMLInputElement).disabled).toBe(false));
    fireEvent.change(input, { target: { value: 'America/New_York' } });
    fireEvent.click(screen.getByRole('button', { name: 'settings.timezone.save' }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ timezone: 'America/New_York' });
    });
  });

  it('shows accessible feedback for an invalid manual timezone', async () => {
    mockUseQuery.mockReturnValue({
      data: { settings: { timezone: 'UTC' } },
      isLoading: false,
    });
    render(<TimezoneSettingsSection />);

    const input = screen.getByLabelText('settings.timezone.label');
    await waitFor(() => expect((input as HTMLInputElement).disabled).toBe(false));
    fireEvent.change(input, {
      target: { value: 'Mars/Phobos' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'settings.timezone.save' }));

    expect((await screen.findByRole('alert')).textContent).toContain('settings.timezone.invalid');
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('uses and persists UTC when browser timezone access is unavailable', async () => {
    vi.mocked(Intl.DateTimeFormat.prototype.resolvedOptions).mockReturnValue({
      locale: 'en-US',
      calendar: 'gregory',
      numberingSystem: 'latn',
      timeZone: 'Mars/Phobos',
    });
    render(<TimezoneSettingsSection />);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ timezone: 'UTC' });
    });
    expect((screen.getByLabelText('settings.timezone.label') as HTMLInputElement).value).toBe(
      'UTC',
    );
  });

  it('renders loading, save success, and save failure states', async () => {
    mockUseQuery.mockReturnValue({ data: null, isLoading: true });
    const loadingView = render(<TimezoneSettingsSection />);
    expect(screen.getByText('common.loading')).toBeDefined();
    loadingView.unmount();

    mockUseQuery.mockReturnValue({ data: { settings: { timezone: 'UTC' } }, isLoading: false });
    mockMutateAsync.mockResolvedValueOnce({ timezone: 'America/New_York' });
    render(<TimezoneSettingsSection />);
    const input = screen.getByLabelText('settings.timezone.label');
    await waitFor(() => expect((input as HTMLInputElement).disabled).toBe(false));
    fireEvent.change(input, {
      target: { value: 'America/New_York' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'settings.timezone.save' }));
    expect((await screen.findByRole('status')).textContent).toContain('settings.timezone.saved');

    mockMutateAsync.mockRejectedValueOnce(new Error('save failed'));
    fireEvent.change(input, {
      target: { value: 'Europe/London' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'settings.timezone.save' }));
    expect((await screen.findByRole('alert')).textContent).toContain('settings.timezone.saveError');
  });

  it('uses translated labels and accessible form controls', () => {
    render(<TimezoneSettingsSection />);

    expect(screen.getByRole('combobox', { name: 'settings.timezone.label' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'settings.timezone.save' })).toBeDefined();
    expect(mockT).toHaveBeenCalledWith('settings.timezone.title');
    expect(mockT).toHaveBeenCalledWith('settings.timezone.description');
  });
});
