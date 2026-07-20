import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { toast } from 'sonner';
import { PasswordSection } from '@/components/settings/PasswordSection';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
  },
}));

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    changePassword: vi.fn(),
  },
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
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
  let authClientMod: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    authClientMod = await import('@/lib/auth-client');
    authClientMod.authClient.changePassword = mockChangePassword;
  });

  it('should render three password fields', () => {
    render(<PasswordSection />);

    expect(screen.getByLabelText('Current Password')).toBeDefined();
    expect(screen.getByLabelText('New Password')).toBeDefined();
    expect(screen.getByLabelText('Confirm New Password')).toBeDefined();
  });

  it('should show validation error when new password is too short', async () => {
    render(<PasswordSection />);

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
    render(<PasswordSection />);

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

    render(<PasswordSection />);

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

  it('should show success toast on successful password change', async () => {
    mockChangePassword.mockResolvedValue({});

    render(<PasswordSection />);

    fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'old' } });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'newPass1234' } });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), {
      target: { value: 'newPass1234' },
    });
    fireEvent.click(screen.getByText('Change Password'));

    await vi.waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Password changed successfully');
    });
  });

  it('should show error message on failed password change', async () => {
    mockChangePassword.mockRejectedValue(new Error('Failed'));

    render(<PasswordSection />);

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

    render(<PasswordSection />);

    const currentInput = screen.getByLabelText('Current Password');
    const newInput = screen.getByLabelText('New Password');
    const confirmInput = screen.getByLabelText('Confirm New Password');

    fireEvent.change(currentInput, { target: { value: 'old' } });
    fireEvent.change(newInput, { target: { value: 'newPass1234' } });
    fireEvent.change(confirmInput, { target: { value: 'newPass1234' } });
    fireEvent.click(screen.getByText('Change Password'));

    // Wait for success toast then check fields are cleared
    await vi.waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });

    expect((currentInput as HTMLInputElement).value).toBe('');
    expect((newInput as HTMLInputElement).value).toBe('');
    expect((confirmInput as HTMLInputElement).value).toBe('');
  });
});
