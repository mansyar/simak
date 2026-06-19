import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PasswordSection } from '@/components/settings/PasswordSection';
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    changePassword: vi.fn(),
  },
}));
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key) => {
      const translations = {
        'settings.password.title': 'Password',
        'settings.password.description': 'Change your current password',
        'settings.password.currentPassword': 'Current Password',
        'settings.password.newPassword': 'New Password',
        'settings.password.confirmPassword': 'Confirm New Password',
        'settings.password.changePassword': 'Change Password',
        'settings.password.passwordSuccess': 'Password changed successfully',
        'settings.password.passwordError': 'Failed to change password',
        'settings.password.passwordMinLength': 'Password must be at least 8 characters',
        'settings.password.passwordMismatch': 'Passwords do not match',
      };
      return translations[key] || key;
    },
  }),
}));
describe('PasswordSection', () => {
  const mockChangePassword = vi.fn();
  let authClientMod;
  beforeEach(async () => {
    vi.clearAllMocks();
    authClientMod = await import('@/lib/auth-client');
    authClientMod.authClient.changePassword = mockChangePassword;
  });
  it('should render three password fields', () => {
    render(_jsx(PasswordSection, {}));
    expect(screen.getByLabelText('Current Password')).toBeDefined();
    expect(screen.getByLabelText('New Password')).toBeDefined();
    expect(screen.getByLabelText('Confirm New Password')).toBeDefined();
  });
  it('should show validation error when new password is too short', async () => {
    render(_jsx(PasswordSection, {}));
    const currentPasswordInput = screen.getByLabelText('Current Password');
    const newPasswordInput = screen.getByLabelText('New Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
    fireEvent.change(currentPasswordInput, { target: { value: 'currentPass123' } });
    fireEvent.change(newPasswordInput, { target: { value: '123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: '123' } });
    fireEvent.click(screen.getByText('Change Password'));
    expect(screen.getByText('Password must be at least 8 characters')).toBeDefined();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });
  it('should show validation error when passwords do not match', async () => {
    render(_jsx(PasswordSection, {}));
    const currentPasswordInput = screen.getByLabelText('Current Password');
    const newPasswordInput = screen.getByLabelText('New Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
    fireEvent.change(currentPasswordInput, { target: { value: 'currentPass123' } });
    fireEvent.change(newPasswordInput, { target: { value: 'newPass1234' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'differentPass' } });
    fireEvent.click(screen.getByText('Change Password'));
    expect(screen.getByText('Passwords do not match')).toBeDefined();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });
  it('should call authClient.changePassword with valid inputs', async () => {
    mockChangePassword.mockResolvedValue({});
    render(_jsx(PasswordSection, {}));
    const currentPasswordInput = screen.getByLabelText('Current Password');
    const newPasswordInput = screen.getByLabelText('New Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm New Password');
    fireEvent.change(currentPasswordInput, { target: { value: 'currentPass123' } });
    fireEvent.change(newPasswordInput, { target: { value: 'newPass1234' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'newPass1234' } });
    fireEvent.click(screen.getByText('Change Password'));
    expect(mockChangePassword).toHaveBeenCalledWith({
      currentPassword: 'currentPass123',
      newPassword: 'newPass1234',
    });
  });
  it('should show success message on successful password change', async () => {
    mockChangePassword.mockResolvedValue({});
    render(_jsx(PasswordSection, {}));
    fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'old' } });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'newPass1234' } });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), {
      target: { value: 'newPass1234' },
    });
    fireEvent.click(screen.getByText('Change Password'));
    expect(await screen.findByText('Password changed successfully')).toBeDefined();
  });
  it('should show error message on failed password change', async () => {
    mockChangePassword.mockRejectedValue(new Error('Failed'));
    render(_jsx(PasswordSection, {}));
    fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'old' } });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'newPass1234' } });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), {
      target: { value: 'newPass1234' },
    });
    fireEvent.click(screen.getByText('Change Password'));
    expect(await screen.findByText('Failed to change password')).toBeDefined();
  });
  it('should clear form fields on successful change', async () => {
    mockChangePassword.mockResolvedValue({});
    render(_jsx(PasswordSection, {}));
    const currentInput = screen.getByLabelText('Current Password');
    const newInput = screen.getByLabelText('New Password');
    const confirmInput = screen.getByLabelText('Confirm New Password');
    fireEvent.change(currentInput, { target: { value: 'old' } });
    fireEvent.change(newInput, { target: { value: 'newPass1234' } });
    fireEvent.change(confirmInput, { target: { value: 'newPass1234' } });
    fireEvent.click(screen.getByText('Change Password'));
    // Wait for success then check fields are cleared
    await screen.findByText('Password changed successfully');
    expect(currentInput.value).toBe('');
    expect(newInput.value).toBe('');
    expect(confirmInput.value).toBe('');
  });
});
