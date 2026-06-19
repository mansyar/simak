import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { authClient } from '../../../lib/auth-client';
import { useI18n } from '../../__root';
import { LanguageSwitcher } from '../../../components/layout/language-switcher';
import { ThemeToggle } from '../../../components/layout/theme-toggle';
import { useTheme } from '../../../hooks/use-theme';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';
export const Route = createFileRoute('/_unauthenticated/auth/forgot-password')({
  component: ForgotPasswordPage,
});
function ForgotPasswordPage() {
  const { t, locale, setLocale } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      // Better-Auth handles the email sending via sendResetPassword config
      // Always return generic success to prevent email enumeration
      await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      setSent(true);
    } catch {
      setSent(true); // Generic success for security
    } finally {
      setIsSubmitting(false);
    }
  };
  if (sent) {
    return _jsx('div', {
      className: 'flex min-h-screen items-center justify-center bg-background p-4',
      children: _jsxs('div', {
        className: 'w-full max-w-sm rounded-xl border bg-card p-8 text-center shadow-lg',
        children: [
          _jsxs('div', {
            className: 'mb-6 flex items-center justify-between',
            children: [
              _jsx(LanguageSwitcher, { currentLocale: locale, onSwitch: setLocale }),
              _jsx(ThemeToggle, { theme: theme, onToggle: toggleTheme }),
            ],
          }),
          _jsx('h1', {
            className: 'mb-2 font-display text-2xl font-bold text-foreground',
            children: t('auth.checkYourEmail'),
          }),
          _jsx('p', {
            className: 'mb-6 text-sm text-muted-foreground',
            children: t('auth.forgotPasswordSent'),
          }),
          _jsx(Link, {
            to: '/auth/login',
            children: _jsx(Button, {
              variant: 'outline',
              className: 'w-full',
              children: t('common.back'),
            }),
          }),
        ],
      }),
    });
  }
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
              children: t('auth.resetPassword'),
            }),
            _jsx('p', {
              className: 'mt-1 text-sm text-muted-foreground',
              children: t('auth.forgotPassword'),
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
                _jsx(Label, { htmlFor: 'email', children: t('auth.email') }),
                _jsx(Input, {
                  id: 'email',
                  type: 'email',
                  value: email,
                  onChange: (e) => setEmail(e.target.value),
                  required: true,
                  placeholder: t('common.emailPlaceholder'),
                  autoComplete: 'email',
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
              disabled: isSubmitting,
              loading: isSubmitting,
              className: 'w-full',
              children: t('common.submit'),
            }),
            _jsx('div', {
              className: 'text-center',
              children: _jsx(Link, {
                to: '/auth/login',
                className: 'text-sm text-primary hover:underline',
                children: t('common.back'),
              }),
            }),
          ],
        }),
      ],
    }),
  });
}
