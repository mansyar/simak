import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationPreferencesSection } from '@/components/settings/NotificationPreferencesSection';

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockMutateAsync = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/server/settings', () => ({
  getCurrentUser: { url: '/api/settings/current-user' },
  updateUserSettings: { url: '/api/settings/update-settings' },
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'en' as const,
    setLocale: vi.fn(),
  }),
}));

describe('NotificationPreferencesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMutation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });
  });

  it('should render loading state when isLoading', () => {
    mockUseQuery.mockReturnValue({ data: null, isLoading: true });

    render(<NotificationPreferencesSection />);

    expect(screen.getByText('common.loading')).toBeDefined();
  });

  it('should render section title and description', () => {
    mockUseQuery.mockReturnValue({
      data: { user: { id: '1' }, settings: null },
      isLoading: false,
    });

    render(<NotificationPreferencesSection />);

    expect(screen.getByText('settings.notificationPreferences.title')).toBeDefined();
    expect(screen.getByText('settings.notificationPreferences.description')).toBeDefined();
  });

  it('should render all 4 group headers', () => {
    mockUseQuery.mockReturnValue({
      data: { user: { id: '1' }, settings: null },
      isLoading: false,
    });

    render(<NotificationPreferencesSection />);

    expect(screen.getByText('settings.notificationPreferences.groups.reviews')).toBeDefined();
    expect(screen.getByText('settings.notificationPreferences.groups.consultations')).toBeDefined();
    expect(screen.getByText('settings.notificationPreferences.groups.submissions')).toBeDefined();
    expect(screen.getByText('settings.notificationPreferences.groups.system')).toBeDefined();
  });

  it('should render all 12 type labels', () => {
    mockUseQuery.mockReturnValue({
      data: { user: { id: '1' }, settings: null },
      isLoading: false,
    });

    render(<NotificationPreferencesSection />);

    const types = [
      'review_completed',
      'revision_requested',
      'consultation_logged',
      'consultation_verified',
      'consultation_rejected',
      'submission_received',
      'extension_requested',
      'extension_approved',
      'extension_rejected',
      'deadline_extended',
      'deadline_reminder',
      'sla_breach',
    ];

    for (const type of types) {
      expect(
        screen.getByText(`settings.notificationPreferences.types.${type}.label`),
      ).toBeDefined();
    }
  });

  it('should render 23 checkboxes (11 types x 2 channels + sla_breach in-app only)', () => {
    mockUseQuery.mockReturnValue({
      data: { user: { id: '1' }, settings: null },
      isLoading: false,
    });

    render(<NotificationPreferencesSection />);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(23);
  });

  it('should default all checkboxes to checked when settings are null', () => {
    mockUseQuery.mockReturnValue({
      data: { user: { id: '1' }, settings: null },
      isLoading: false,
    });

    render(<NotificationPreferencesSection />);

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    for (const cb of checkboxes) {
      expect(cb.checked).toBe(true);
    }
  });

  it('should default all checkboxes to checked when notificationPrefs is absent', () => {
    mockUseQuery.mockReturnValue({
      data: { user: { id: '1' }, settings: { reducedMotion: false } },
      isLoading: false,
    });

    render(<NotificationPreferencesSection />);

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    for (const cb of checkboxes) {
      expect(cb.checked).toBe(true);
    }
  });

  it('should show email checkbox as unchecked when email is false', () => {
    mockUseQuery.mockReturnValue({
      data: {
        user: { id: '1' },
        settings: {
          notificationPrefs: { review_completed: { email: false } },
        },
      },
      isLoading: false,
    });

    const { container } = render(<NotificationPreferencesSection />);

    const emailCheckbox = container.querySelector(
      '#notif-review_completed-email',
    ) as HTMLInputElement;
    expect(emailCheckbox.checked).toBe(false);

    const inAppCheckbox = container.querySelector(
      '#notif-review_completed-inApp',
    ) as HTMLInputElement;
    expect(inAppCheckbox.checked).toBe(true);
  });

  it('should show in-app checkbox as unchecked when inApp is false', () => {
    mockUseQuery.mockReturnValue({
      data: {
        user: { id: '1' },
        settings: {
          notificationPrefs: { sla_breach: { inApp: false } },
        },
      },
      isLoading: false,
    });

    const { container } = render(<NotificationPreferencesSection />);

    const inAppCheckbox = container.querySelector('#notif-sla_breach-inApp') as HTMLInputElement;
    expect(inAppCheckbox.checked).toBe(false);

    // sla_breach email toggle is hidden (emailAlwaysOn — sla_alert exempt per FR-8)
    const emailCheckbox = container.querySelector('#notif-sla_breach-email');
    expect(emailCheckbox).toBeNull();
  });

  it('should call updateUserSettings with full prefs when email checkbox toggled off', () => {
    mockUseQuery.mockReturnValue({
      data: { user: { id: '1' }, settings: null },
      isLoading: false,
    });

    const { container } = render(<NotificationPreferencesSection />);

    const emailCheckbox = container.querySelector(
      '#notif-review_completed-email',
    ) as HTMLInputElement;
    fireEvent.click(emailCheckbox);

    expect(mockMutateAsync).toHaveBeenCalledWith({
      notificationPrefs: { review_completed: { email: false } },
    });
  });

  it('should call updateUserSettings with full prefs when in-app checkbox toggled off', () => {
    mockUseQuery.mockReturnValue({
      data: { user: { id: '1' }, settings: null },
      isLoading: false,
    });

    const { container } = render(<NotificationPreferencesSection />);

    const inAppCheckbox = container.querySelector(
      '#notif-consultation_logged-inApp',
    ) as HTMLInputElement;
    fireEvent.click(inAppCheckbox);

    expect(mockMutateAsync).toHaveBeenCalledWith({
      notificationPrefs: { consultation_logged: { inApp: false } },
    });
  });

  it('should preserve existing prefs when toggling a new type', () => {
    mockUseQuery.mockReturnValue({
      data: {
        user: { id: '1' },
        settings: {
          notificationPrefs: { consultation_logged: { inApp: false } },
        },
      },
      isLoading: false,
    });

    const { container } = render(<NotificationPreferencesSection />);

    const emailCheckbox = container.querySelector(
      '#notif-review_completed-email',
    ) as HTMLInputElement;
    fireEvent.click(emailCheckbox);

    expect(mockMutateAsync).toHaveBeenCalledWith({
      notificationPrefs: {
        consultation_logged: { inApp: false },
        review_completed: { email: false },
      },
    });
  });

  it('should toggle email back to true when clicked again', () => {
    mockUseQuery.mockReturnValue({
      data: {
        user: { id: '1' },
        settings: {
          notificationPrefs: { review_completed: { email: false } },
        },
      },
      isLoading: false,
    });

    const { container } = render(<NotificationPreferencesSection />);

    const emailCheckbox = container.querySelector(
      '#notif-review_completed-email',
    ) as HTMLInputElement;
    fireEvent.click(emailCheckbox);

    expect(mockMutateAsync).toHaveBeenCalledWith({
      notificationPrefs: { review_completed: { email: true } },
    });
  });
});
