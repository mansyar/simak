import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { authClient } from '../../../lib/auth-client';
import { useI18n } from '../../__root';
import { LanguageSwitcher } from '../../../components/layout/language-switcher';
import { ThemeToggle } from '../../../components/layout/theme-toggle';
import { useTheme } from '../../../hooks/use-theme';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';
export const Route = createFileRoute('/_unauthenticated/auth/verify-2fa')({
  component: Verify2FAPage,
});
function Verify2FAPage() {
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await authClient.twoFactor.verifyTotp({
        code,
        trustDevice: false,
      });
      if (result.error) {
        setError(result.error.message ?? t('auth.invalidCode'));
      } else {
        router.invalidate();
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  };
  return _jsx('div', {
    className: 'flex min-h-screen items-center justify-center bg-background p-4',
    children: _jsxs('div', {
      className: 'w-full max-w-sm rounded-xl border bg-card p-8 shadow-lg',
      children: [
        _jsxs('div', {
          className: 'mb-6 flex items-center justify-between',
          children: [
            _jsx(LanguageSwitcher, { currentLocale: locale, onSwitch: setLocale }),
            _jsx(ThemeToggle, { theme: theme, onToggle: toggleTheme }),
          ],
        }),
        _jsxs('div', {
          className: 'mb-6 text-center',
          children: [
            _jsx('h1', {
              className: 'font-display text-2xl font-bold text-foreground',
              children: t('auth.verifyTwoFactor'),
            }),
            _jsx('p', {
              className: 'mt-1 text-sm text-muted-foreground',
              children: t('auth.verifyTwoFactorDescription'),
            }),
          ],
        }),
        _jsxs('form', {
          onSubmit: handleSubmit,
          className: 'flex flex-col gap-4',
          children: [
            _jsxs('div', {
              className: 'flex flex-col gap-1.5',
              children: [
                _jsx(Label, { htmlFor: 'code', children: t('auth.totpCode') }),
                _jsx(Input, {
                  id: 'code',
                  type: 'text',
                  inputMode: 'numeric',
                  pattern: '[0-9]*',
                  maxLength: 8,
                  value: code,
                  onChange: (e) => setCode(e.target.value.replace(/\D/g, '')),
                  required: true,
                  placeholder: '000000',
                  autoComplete: 'one-time-code',
                  autoFocus: true,
                }),
              ],
            }),
            error &&
              _jsx('div', {
                className: 'rounded-md bg-destructive/10 p-3 text-sm text-destructive',
                role: 'alert',
                children: error,
              }),
            _jsx(Button, {
              type: 'submit',
              disabled: isSubmitting || code.length < 6,
              loading: isSubmitting,
              className: 'w-full',
              children: t('common.verify'),
            }),
            _jsxs('div', {
              className: 'flex flex-col items-center gap-2 text-center',
              children: [
                _jsx(Link, {
                  to: '/auth/verify-backup-code',
                  className: 'text-sm text-primary hover:underline',
                  children: t('auth.useBackupCode'),
                }),
                _jsx(Link, {
                  to: '/auth/login',
                  className: 'text-sm text-muted-foreground hover:underline',
                  children: t('common.back'),
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  });
}
