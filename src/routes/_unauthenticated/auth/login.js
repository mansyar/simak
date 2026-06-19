import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { authClient } from '../../../lib/auth-client';
import { useI18n } from '../../__root';
import { ThemeToggle } from '../../../components/layout/theme-toggle';
import { LanguageSwitcher } from '../../../components/layout/language-switcher';
import { useTheme } from '../../../hooks/use-theme';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';
export const Route = createFileRoute('/_unauthenticated/auth/login')({
  component: LoginPage,
});
function LoginPage() {
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message ?? t('auth.invalidCredentials'));
      } else {
        // Check if 2FA redirect is required
        const data = result.data;
        if (data?.twoFactorRedirect) {
          router.navigate({ to: '/auth/verify-2fa' });
        } else {
          router.invalidate();
        }
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
      id: 'main-content',
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
              className: 'font-display text-3xl font-bold text-foreground',
              children: '\uD83C\uDF93 SIMAK',
            }),
            _jsx('p', {
              className: 'mt-1 text-sm text-muted-foreground',
              children: t('auth.signIn'),
            }),
          ],
        }),
        _jsxs('form', {
          onSubmit: handleSubmit,
          className: 'flex flex-col gap-4',
          noValidate: true,
          children: [
            _jsxs('div', {
              className: 'flex flex-col gap-1.5',
              children: [
                _jsx(Label, { htmlFor: 'email', children: t('auth.email') }),
                _jsx(Input, {
                  id: 'email',
                  type: 'email',
                  value: email,
                  onChange: (e) => setEmail(e.target.value),
                  required: true,
                  'aria-required': 'true',
                  'aria-describedby': error ? 'login-error' : undefined,
                  placeholder: t('common.emailPlaceholder'),
                  autoComplete: 'email',
                }),
              ],
            }),
            _jsxs('div', {
              className: 'flex flex-col gap-1.5',
              children: [
                _jsx(Label, { htmlFor: 'password', children: t('auth.password') }),
                _jsx(Input, {
                  id: 'password',
                  type: 'password',
                  value: password,
                  onChange: (e) => setPassword(e.target.value),
                  required: true,
                  'aria-required': 'true',
                  placeholder: t('auth.password'),
                  autoComplete: 'current-password',
                }),
              ],
            }),
            error &&
              _jsx('div', {
                id: 'login-error',
                className: 'rounded-md bg-destructive/10 p-3 text-sm text-destructive',
                role: 'alert',
                children: error,
              }),
            _jsx(Button, {
              type: 'submit',
              disabled: isSubmitting,
              loading: isSubmitting,
              className: 'w-full',
              children: t('auth.signIn'),
            }),
            _jsx('div', {
              className: 'text-center',
              children: _jsx('a', {
                href: '/auth/forgot-password',
                className: 'text-sm text-primary hover:underline',
                children: t('auth.forgotPassword'),
              }),
            }),
          ],
        }),
      ],
    }),
  });
}
