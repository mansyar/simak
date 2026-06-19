import { jsxs as _jsxs, jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TwoFactorSettings } from '@/components/settings/TwoFactorSettings';
const {
  mockGetTwoFactorStatus,
  mockGenerateTwoFactorSetup,
  mockEnableTwoFactor,
  mockDisableTwoFactor,
  mockUseQuery,
} = vi.hoisted(() => ({
  mockGetTwoFactorStatus: vi.fn().mockResolvedValue({ enabled: false }),
  mockGenerateTwoFactorSetup: vi.fn().mockRejectedValue(new Error('No setup config')),
  mockEnableTwoFactor: vi.fn().mockRejectedValue(new Error('No enable config')),
  mockDisableTwoFactor: vi.fn().mockRejectedValue(new Error('No disable config')),
  mockUseQuery: vi.fn(),
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: mockUseQuery,
  useMutation: (config) => ({
    mutate: (...args) => {
      const mutationFn = config?.mutationFn;
      if (mutationFn) {
        return Promise.resolve(mutationFn(...args)).then(
          (result) => {
            config?.onSuccess?.(result);
            return result;
          },
          (err) => {
            config?.onError?.(err);
          },
        );
      }
    },
    isPending: false,
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('@/server/two-factor', () => ({
  getTwoFactorStatus: mockGetTwoFactorStatus,
  generateTwoFactorSetup: mockGenerateTwoFactorSetup,
  enableTwoFactor: mockEnableTwoFactor,
  disableTwoFactor: mockDisableTwoFactor,
}));
vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }) => _jsxs('div', { 'data-testid': 'qr-code', children: ['QR:', value] }),
}));
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key) => {
      const translations = {
        'settings.twoFactor.title': 'Two-Factor Authentication',
        'settings.twoFactor.description': 'Add an extra layer of security to your account.',
        'settings.twoFactor.enabled': 'Enabled',
        'settings.twoFactor.disabled': 'Disabled',
        'settings.twoFactor.enable': 'Enable',
        'settings.twoFactor.disable': 'Disable',
        'settings.twoFactor.enableTitle': 'Enable Two-Factor Authentication',
        'settings.twoFactor.enableDescription':
          'Set up two-factor authentication for your account.',
        'settings.twoFactor.confirmPassword': 'Confirm Password',
        'settings.password': 'Password',
        'settings.twoFactor.scanQR': 'Scan this QR code with your authenticator app.',
        'settings.twoFactor.continueToVerify': 'Continue to Verify',
        'settings.twoFactor.enterCode': 'Enter the code from your authenticator app.',
        'settings.twoFactor.totpCode': 'Authentication Code',
        'settings.twoFactor.setup': 'Set up',
        'common.verify': 'Verify',
        'common.cancel': 'Cancel',
        'settings.twoFactor.disableTitle': 'Disable Two-Factor Authentication',
        'settings.twoFactor.disableDescription': 'This will reduce the security of your account.',
        'settings.twoFactor.setupError': 'Failed to generate setup',
        'settings.twoFactor.verifyError': 'Failed to verify code',
        'settings.twoFactor.disableError': 'Failed to disable',
        'settings.twoFactor.saveBackupCodes': 'Save these backup codes in a secure place.',
      };
      return translations[key] || key;
    },
  }),
}));
describe('TwoFactorSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTwoFactorStatus.mockResolvedValue({ enabled: false });
    mockGenerateTwoFactorSetup.mockRejectedValue(new Error('No setup config'));
    mockEnableTwoFactor.mockRejectedValue(new Error('No enable config'));
    mockDisableTwoFactor.mockRejectedValue(new Error('No disable config'));
    mockUseQuery.mockReturnValue({ data: { enabled: false }, isLoading: false });
  });
  // ---------- 1. Loading State ----------
  it('should show loading spinner when status is loading', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(_jsx(TwoFactorSettings, {}));
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeDefined();
  });
  // ---------- 2. Disabled State ----------
  it('should show Disabled badge and Enable button when 2FA is disabled', () => {
    mockUseQuery.mockReturnValue({ data: { enabled: false }, isLoading: false });
    render(_jsx(TwoFactorSettings, {}));
    expect(screen.getByText('Disabled')).toBeDefined();
    expect(screen.getByText('Enable')).toBeDefined();
  });
  // ---------- 3. Enabled State ----------
  it('should show Enabled badge and Disable button when 2FA is enabled', () => {
    mockUseQuery.mockReturnValue({ data: { enabled: true }, isLoading: false });
    render(_jsx(TwoFactorSettings, {}));
    expect(screen.getByText('Enabled')).toBeDefined();
    expect(screen.getByText('Disable')).toBeDefined();
  });
  // ---------- 4. Open Enable Dialog ----------
  it('should open enable dialog when Enable button is clicked', () => {
    render(_jsx(TwoFactorSettings, {}));
    fireEvent.click(screen.getByText('Enable'));
    expect(screen.getByText('Enable Two-Factor Authentication')).toBeDefined();
    expect(screen.getByLabelText('Confirm Password')).toBeDefined();
  });
  // ---------- 5. Enable Dialog: Password Step -> Error from generateTwoFactorSetup ----------
  it('should show error when generateTwoFactorSetup returns an error', async () => {
    mockGenerateTwoFactorSetup.mockResolvedValue({ error: 'Password incorrect' });
    render(_jsx(TwoFactorSettings, {}));
    fireEvent.click(screen.getByText('Enable'));
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'wrongpassword' },
    });
    fireEvent.click(screen.getByText('Set up'));
    expect(await screen.findByText('Password incorrect')).toBeDefined();
  });
  // ---------- 6. Enable Dialog: Password Step -> QR Step ----------
  it('should show QR code after successful password step', async () => {
    mockGenerateTwoFactorSetup.mockResolvedValue({
      totpURI: 'otpauth://totp/test?secret=ABC123',
      backupCodes: ['12345', '67890'],
    });
    render(_jsx(TwoFactorSettings, {}));
    fireEvent.click(screen.getByText('Enable'));
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'mypassword' },
    });
    fireEvent.click(screen.getByText('Set up'));
    expect(await screen.findByTestId('qr-code')).toBeDefined();
    expect(screen.getByText('Continue to Verify')).toBeDefined();
  });
  // ---------- 7. Enable Dialog: QR Step -> Verify Step ----------
  it('should show verify step with backup codes after clicking Continue to Verify', async () => {
    mockGenerateTwoFactorSetup.mockResolvedValue({
      totpURI: 'otpauth://totp/test?secret=ABC123',
      backupCodes: ['12345', '67890'],
    });
    render(_jsx(TwoFactorSettings, {}));
    fireEvent.click(screen.getByText('Enable'));
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'mypassword' },
    });
    fireEvent.click(screen.getByText('Set up'));
    expect(await screen.findByTestId('qr-code')).toBeDefined();
    fireEvent.click(screen.getByText('Continue to Verify'));
    expect(screen.getByLabelText('Authentication Code')).toBeDefined();
    expect(screen.getByText('Verify')).toBeDefined();
    expect(screen.getByText('12345')).toBeDefined();
    expect(screen.getByText('67890')).toBeDefined();
  });
  // ---------- 8. Enable Dialog: Verify Step -> Error ----------
  it('should show error when enableTwoFactor returns an error', async () => {
    mockGenerateTwoFactorSetup.mockResolvedValue({
      totpURI: 'otpauth://totp/test?secret=ABC123',
      backupCodes: ['12345', '67890'],
    });
    mockEnableTwoFactor.mockResolvedValue({ error: 'Invalid code' });
    render(_jsx(TwoFactorSettings, {}));
    fireEvent.click(screen.getByText('Enable'));
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'mypassword' },
    });
    fireEvent.click(screen.getByText('Set up'));
    expect(await screen.findByTestId('qr-code')).toBeDefined();
    fireEvent.click(screen.getByText('Continue to Verify'));
    fireEvent.change(screen.getByLabelText('Authentication Code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByText('Verify'));
    expect(await screen.findByText('Invalid code')).toBeDefined();
  });
  // ---------- 9. Enable Dialog: Verify Step -> Complete ----------
  it('should close dialog when enableTwoFactor succeeds', async () => {
    mockGenerateTwoFactorSetup.mockResolvedValue({
      totpURI: 'otpauth://totp/test?secret=ABC123',
      backupCodes: ['12345', '67890'],
    });
    mockEnableTwoFactor.mockResolvedValue({ success: true });
    render(_jsx(TwoFactorSettings, {}));
    fireEvent.click(screen.getByText('Enable'));
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'mypassword' },
    });
    fireEvent.click(screen.getByText('Set up'));
    expect(await screen.findByTestId('qr-code')).toBeDefined();
    fireEvent.click(screen.getByText('Continue to Verify'));
    fireEvent.change(screen.getByLabelText('Authentication Code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByText('Verify'));
    await vi.waitFor(() => {
      expect(screen.queryByText('Enable Two-Factor Authentication')).toBeNull();
    });
  });
  // ---------- 10. Disable Dialog: Error ----------
  it('should show error when disableTwoFactor returns an error', async () => {
    mockUseQuery.mockReturnValue({ data: { enabled: true }, isLoading: false });
    mockDisableTwoFactor.mockResolvedValue({ error: 'Wrong password' });
    render(_jsx(TwoFactorSettings, {}));
    fireEvent.click(screen.getByText('Disable'));
    expect(screen.getByText('Disable Two-Factor Authentication')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'wrongpassword' },
    });
    const disableButtons = screen.getAllByText('Disable');
    const dialogDisableButton = disableButtons[disableButtons.length - 1];
    fireEvent.click(dialogDisableButton);
    expect(await screen.findByText('Wrong password')).toBeDefined();
  });
  // ---------- 11. Disable Dialog: Complete ----------
  it('should close dialog when disableTwoFactor succeeds', async () => {
    mockUseQuery.mockReturnValue({ data: { enabled: true }, isLoading: false });
    mockDisableTwoFactor.mockResolvedValue({ success: true });
    render(_jsx(TwoFactorSettings, {}));
    fireEvent.click(screen.getByText('Disable'));
    expect(screen.getByText('Disable Two-Factor Authentication')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'correctpassword' },
    });
    const disableButtons = screen.getAllByText('Disable');
    const dialogDisableButton = disableButtons[disableButtons.length - 1];
    fireEvent.click(dialogDisableButton);
    await vi.waitFor(() => {
      expect(screen.queryByText('Disable Two-Factor Authentication')).toBeNull();
    });
  });
  // ---------- 12. Disable Dialog: Close via Cancel ----------
  it('should close disable dialog when Cancel is clicked', () => {
    mockUseQuery.mockReturnValue({ data: { enabled: true }, isLoading: false });
    render(_jsx(TwoFactorSettings, {}));
    fireEvent.click(screen.getByText('Disable'));
    expect(screen.getByText('Disable Two-Factor Authentication')).toBeDefined();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Disable Two-Factor Authentication')).toBeNull();
  });
  // ---------- 13. Enable Dialog: Close via Cancel ----------
  it('should close enable dialog when Cancel is clicked', () => {
    render(_jsx(TwoFactorSettings, {}));
    fireEvent.click(screen.getByText('Enable'));
    expect(screen.getByText('Enable Two-Factor Authentication')).toBeDefined();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Enable Two-Factor Authentication')).toBeNull();
  });
  // ---------- 14. TOTP Input Filtering ----------
  it('should filter TOTP input to digits only and max 6 chars', async () => {
    mockGenerateTwoFactorSetup.mockResolvedValue({
      totpURI: 'otpauth://totp/test?secret=ABC123',
      backupCodes: ['12345', '67890'],
    });
    render(_jsx(TwoFactorSettings, {}));
    fireEvent.click(screen.getByText('Enable'));
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'mypassword' },
    });
    fireEvent.click(screen.getByText('Set up'));
    expect(await screen.findByTestId('qr-code')).toBeDefined();
    fireEvent.click(screen.getByText('Continue to Verify'));
    const totpInput = screen.getByLabelText('Authentication Code');
    fireEvent.change(totpInput, { target: { value: 'abc123def' } });
    expect(totpInput.value).toBe('123');
    fireEvent.change(totpInput, { target: { value: '123456789' } });
    expect(totpInput.value).toBe('123456');
  });
  // ---------- 15. Generate Setup OnError ----------
  it('should show setup error on generateTwoFactorSetup network failure', async () => {
    mockGenerateTwoFactorSetup.mockRejectedValue(new Error('Network error'));
    render(_jsx(TwoFactorSettings, {}));
    fireEvent.click(screen.getByText('Enable'));
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'mypassword' },
    });
    fireEvent.click(screen.getByText('Set up'));
    expect(await screen.findByText('Failed to generate setup')).toBeDefined();
  });
  // ---------- 16. Enable Mutation OnError ----------
  it('should show verify error on enableTwoFactor network failure', async () => {
    mockGenerateTwoFactorSetup.mockResolvedValue({
      totpURI: 'otpauth://totp/test?secret=ABC123',
      backupCodes: ['12345', '67890'],
    });
    mockEnableTwoFactor.mockRejectedValue(new Error('Network error'));
    render(_jsx(TwoFactorSettings, {}));
    fireEvent.click(screen.getByText('Enable'));
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'mypassword' },
    });
    fireEvent.click(screen.getByText('Set up'));
    expect(await screen.findByTestId('qr-code')).toBeDefined();
    fireEvent.click(screen.getByText('Continue to Verify'));
    fireEvent.change(screen.getByLabelText('Authentication Code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByText('Verify'));
    expect(await screen.findByText('Failed to verify code')).toBeDefined();
  });
  // ---------- 17. Disable Mutation OnError ----------
  it('should show disable error on disableTwoFactor network failure', async () => {
    mockUseQuery.mockReturnValue({ data: { enabled: true }, isLoading: false });
    mockDisableTwoFactor.mockRejectedValue(new Error('Network error'));
    render(_jsx(TwoFactorSettings, {}));
    fireEvent.click(screen.getByText('Disable'));
    expect(screen.getByText('Disable Two-Factor Authentication')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'password' },
    });
    const disableButtons = screen.getAllByText('Disable');
    const dialogDisableButton = disableButtons[disableButtons.length - 1];
    fireEvent.click(dialogDisableButton);
    expect(await screen.findByText('Failed to disable')).toBeDefined();
  });
  // ---------- 18. Enable Dialog: Close then reopen resets state ----------
  it('should reset enable dialog state when closed and reopened', () => {
    render(_jsx(TwoFactorSettings, {}));
    fireEvent.click(screen.getByText('Enable'));
    expect(screen.getByText('Enable Two-Factor Authentication')).toBeDefined();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Enable Two-Factor Authentication')).toBeNull();
    fireEvent.click(screen.getByText('Enable'));
    expect(screen.getByText('Enable Two-Factor Authentication')).toBeDefined();
  });
});
