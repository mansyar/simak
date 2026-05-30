import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-qr-code', () => ({
  default: ({ value }: { value: string }) => <div data-testid="qr-code" data-value={value} />,
}));

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    twoFactor: {
      enable: vi.fn(),
      verifyTotp: vi.fn(),
      disable: vi.fn(),
      generateBackupCodes: vi.fn(),
    },
  },
}));

const mockUseQuery = vi.fn();
const mockInvalidateQueries = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

vi.mock('@/server/two-factor', () => ({
  getTwoFactorStatus: { url: '/api/two-factor/status' },
  generateTwoFactorSetup: { url: '/api/two-factor/setup' },
  enableTwoFactor: { url: '/api/two-factor/enable' },
  disableTwoFactor: { url: '/api/two-factor/disable' },
  getBackupCodes: { url: '/api/two-factor/backup-codes' },
  regenerateBackupCodes: { url: '/api/two-factor/regenerate-codes' },
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'settings.twoFactor.title': 'Two-Factor Authentication',
        'settings.twoFactor.description': 'Add an extra layer of security',
        'settings.twoFactor.enabled': 'Enabled',
        'settings.twoFactor.disabled': 'Disabled',
        'settings.twoFactor.enable': 'Enable 2FA',
        'settings.twoFactor.disable': 'Disable 2FA',
        'settings.twoFactor.enableTitle': 'Enable Two-Factor Authentication',
        'settings.twoFactor.enableDescription': 'Scan the QR code',
        'settings.twoFactor.confirmPassword': 'Enter your password',
        'settings.twoFactor.setup': 'Setup',
        'settings.twoFactor.scanQR': 'Scan this QR code',
        'settings.twoFactor.continueToVerify': 'Continue to Verification',
        'settings.twoFactor.enterCode': 'Enter the 6-digit code',
        'settings.twoFactor.totpCode': 'Verification Code',
        'settings.twoFactor.verify': 'Verify',
        'settings.twoFactor.setupError': 'Failed to set up 2FA',
        'settings.twoFactor.verifyError': 'Invalid verification code',
        'settings.twoFactor.disableTitle': 'Disable Two-Factor Authentication',
        'settings.twoFactor.disableDescription': 'Enter your password to disable',
        'settings.twoFactor.disableError': 'Failed to disable 2FA',
        'settings.twoFactor.viewBackupCodes': 'View Backup Codes',
        'settings.twoFactor.backupCodesTitle': 'Backup Codes',
        'settings.twoFactor.backupCodesDescription': 'Save these codes',
        'settings.twoFactor.copy': 'Copy',
        'settings.twoFactor.download': 'Download',
        'settings.twoFactor.regenerate': 'Regenerate Codes',
        'settings.twoFactor.regenerateError': 'Failed to regenerate',
        'settings.twoFactor.saveBackupCodes': 'Save Backup Codes',
        'settings.password': 'Password',
        'common.cancel': 'Cancel',
        'common.close': 'Close',
        'common.verify': 'Verify',
        'common.loading': 'Loading...',
      };
      return translations[key] || key;
    },
  }),
}));

import { TwoFactorSettings } from '@/components/settings/TwoFactorSettings';

describe('TwoFactorSettings', () => {
  it('should render component without errors', () => {
    mockUseQuery.mockReturnValue({ data: null, isLoading: false });
    render(<TwoFactorSettings />);
    expect(screen.getByText('Two-Factor Authentication')).toBeDefined();
  });

  it('should show disabled status when 2FA is not enabled', () => {
    mockUseQuery.mockReturnValue({ data: { enabled: false }, isLoading: false });
    render(<TwoFactorSettings />);
    expect(screen.getByText('Disabled')).toBeDefined();
  });

  it('should show enabled status when 2FA is enabled', () => {
    mockUseQuery.mockReturnValue({ data: { enabled: true }, isLoading: false });
    render(<TwoFactorSettings />);
    expect(screen.getByText('Enabled')).toBeDefined();
  });

  it('should show enable button when 2FA is disabled', () => {
    mockUseQuery.mockReturnValue({ data: { enabled: false }, isLoading: false });
    render(<TwoFactorSettings />);
    expect(screen.getByText('Enable 2FA')).toBeDefined();
  });

  it('should show disable button when 2FA is enabled', () => {
    mockUseQuery.mockReturnValue({ data: { enabled: true }, isLoading: false });
    render(<TwoFactorSettings />);
    expect(screen.getByText('Disable 2FA')).toBeDefined();
  });

  it('should show loading state', () => {
    mockUseQuery.mockReturnValue({ data: null, isLoading: true });
    const { container } = render(<TwoFactorSettings />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeDefined();
  });

  it('should show description text', () => {
    mockUseQuery.mockReturnValue({ data: null, isLoading: false });
    render(<TwoFactorSettings />);
    expect(screen.getByText('Add an extra layer of security')).toBeDefined();
  });
});
