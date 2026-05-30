import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsPage } from '@/components/settings/SettingsPage';

// Mock child dependencies
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
  updateProfile: { url: '/api/settings/update-profile' },
  updateUserSettings: { url: '/api/settings/update-settings' },
  getPresignedAvatarUploadUrl: { url: '/api/settings/avatar-upload-url' },
}));

vi.mock('@/server/two-factor', () => ({
  getTwoFactorStatus: { url: '/api/two-factor/status' },
  generateTwoFactorSetup: { url: '/api/two-factor/setup' },
  enableTwoFactor: { url: '/api/two-factor/enable' },
  disableTwoFactor: { url: '/api/two-factor/disable' },
  regenerateBackupCodes: { url: '/api/two-factor/regenerate-codes' },
}));

vi.mock('@/server/sessions', () => ({
  listActiveSessions: { url: '/api/sessions/list' },
  revokeSession: { url: '/api/sessions/revoke' },
  revokeAllOtherSessions: { url: '/api/sessions/revoke-all' },
}));

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    changePassword: vi.fn(),
    twoFactor: {
      enable: vi.fn(),
      verifyTotp: vi.fn(),
      disable: vi.fn(),
      generateBackupCodes: vi.fn(),
    },
  },
}));

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    theme: 'light' as const,
    toggleTheme: vi.fn(),
  }),
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'settings.profile.title': 'Profile',
        'settings.profile.nameLabel': 'Name',
        'settings.profile.emailLabel': 'Email',
        'settings.profile.avatarLabel': 'Profile Picture',
        'settings.profile.saveName': 'Save Name',
        'settings.password.title': 'Password',
        'settings.password.description': 'Change your current password',
        'settings.password.currentPassword': 'Current Password',
        'settings.password.newPassword': 'New Password',
        'settings.password.confirmPassword': 'Confirm New Password',
        'settings.password.changePassword': 'Change Password',
        'settings.twoFactor.title': 'Two-Factor Authentication',
        'settings.twoFactor.description': 'Add an extra layer of security',
        'settings.twoFactor.enabled': 'Enabled',
        'settings.twoFactor.disabled': 'Disabled',
        'settings.twoFactor.enable': 'Enable 2FA',
        'settings.twoFactor.disable': 'Disable 2FA',
        'settings.sessions.title': 'Active Sessions',
        'settings.sessions.description': 'Manage your active login sessions across devices.',
        'settings.sessions.noSessions': 'No active sessions found.',
        'settings.appearance.title': 'Appearance',
        'settings.appearance.description': 'Customize how the application looks',
        'settings.appearance.languageLabel': 'Language',
        'settings.appearance.themeLabel': 'Theme',
        'settings.accessibility.title': 'Accessibility',
        'settings.accessibility.description': 'Accessibility settings for a better experience',
        'settings.accessibility.reducedMotionLabel': 'Reduced Motion',
        'settings.accessibility.reducedMotionHint':
          'Reduce animations and transitions throughout the app',
        'theme.light': 'Light',
        'theme.dark': 'Dark',
        'theme.toggle': 'Toggle theme',
        'language.en': 'English',
        'language.id': 'Bahasa Indonesia',
        'common.loading': 'Loading...',
        'common.cancel': 'Cancel',
        'common.close': 'Close',
        'common.verify': 'Verify',
        'settings.password': 'Password',
      };
      return translations[key] || key;
    },
    locale: 'en' as const,
    setLocale: vi.fn(),
  }),
}));

// Mock qrcode.react
vi.mock('qrcode.react', () => ({
  QRCodeSVG: () => <div data-testid="qr-code" />,
}));

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMutation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });
    mockUseQuery.mockReturnValue({
      data: {
        user: { id: '1', name: 'John', email: 'john@test.com', image: null },
        settings: { reducedMotion: false },
      },
      isLoading: false,
    });
  });

  it('should render all 6 section titles in correct order', () => {
    const { container } = render(<SettingsPage />);

    const sectionTitles = container.querySelectorAll('[data-slot="card-title"]');
    expect(sectionTitles[0].textContent).toBe('Profile');
    expect(sectionTitles[1].textContent).toBe('Password');
    expect(sectionTitles[2].textContent).toBe('Two-Factor Authentication');
    expect(sectionTitles[3].textContent).toBe('Active Sessions');
    expect(sectionTitles[4].textContent).toBe('Appearance');
    expect(sectionTitles[5].textContent).toBe('Accessibility');
  });

  it('should render in a container with correct CSS classes', () => {
    const { container } = render(<SettingsPage />);

    const mainContainer = container.firstChild as HTMLElement;
    expect(mainContainer.className).toContain('space-y-6');
  });
});
