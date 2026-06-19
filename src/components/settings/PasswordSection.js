import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { useI18n } from '@/routes/__root';
export function PasswordSection() {
  const { t } = useI18n();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);
  const validate = () => {
    if (newPassword.length < 8) {
      return t('settings.password.passwordMinLength');
    }
    if (newPassword !== confirmPassword) {
      return t('settings.password.passwordMismatch');
    }
    return null;
  };
  const handleChangePassword = async () => {
    setSuccess('');
    setError('');
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsPending(true);
    try {
      await authClient.changePassword({
        currentPassword,
        newPassword,
      });
      setSuccess(t('settings.password.passwordSuccess'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setError(t('settings.password.passwordError'));
    } finally {
      setIsPending(false);
    }
  };
  return _jsxs(Card, {
    children: [
      _jsxs(CardHeader, {
        children: [
          _jsxs(CardTitle, {
            className: 'flex items-center gap-2',
            children: [_jsx(KeyRound, { className: 'h-5 w-5' }), t('settings.password.title')],
          }),
          _jsx(CardDescription, { children: t('settings.password.description') }),
        ],
      }),
      _jsxs(CardContent, {
        className: 'space-y-4',
        children: [
          _jsxs('div', {
            className: 'space-y-2',
            children: [
              _jsx(Label, {
                htmlFor: 'current-password',
                children: t('settings.password.currentPassword'),
              }),
              _jsx(Input, {
                id: 'current-password',
                type: 'password',
                value: currentPassword,
                onChange: (e) => setCurrentPassword(e.target.value),
                'aria-label': t('settings.password.currentPassword'),
              }),
            ],
          }),
          _jsxs('div', {
            className: 'space-y-2',
            children: [
              _jsx(Label, {
                htmlFor: 'new-password',
                children: t('settings.password.newPassword'),
              }),
              _jsx(Input, {
                id: 'new-password',
                type: 'password',
                value: newPassword,
                onChange: (e) => setNewPassword(e.target.value),
                'aria-label': t('settings.password.newPassword'),
              }),
            ],
          }),
          _jsxs('div', {
            className: 'space-y-2',
            children: [
              _jsx(Label, {
                htmlFor: 'confirm-password',
                children: t('settings.password.confirmPassword'),
              }),
              _jsx(Input, {
                id: 'confirm-password',
                type: 'password',
                value: confirmPassword,
                onChange: (e) => setConfirmPassword(e.target.value),
                'aria-label': t('settings.password.confirmPassword'),
              }),
            ],
          }),
          success &&
            _jsx('div', {
              className:
                'text-sm text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400 p-3 rounded-md',
              children: success,
            }),
          error &&
            _jsx('div', {
              className: 'text-sm text-destructive bg-destructive/10 p-3 rounded-md',
              children: error,
            }),
          _jsx(Button, {
            onClick: handleChangePassword,
            disabled: isPending,
            children: t('settings.password.changePassword'),
          }),
        ],
      }),
    ],
  });
}
