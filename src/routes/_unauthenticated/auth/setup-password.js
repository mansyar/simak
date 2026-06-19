import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { completePasswordSetup } from '../../../server/setup-password';
import { useI18n } from '../../__root';
import { LanguageSwitcher } from '../../../components/layout/language-switcher';
import { ThemeToggle } from '../../../components/layout/theme-toggle';
import { useTheme } from '../../../hooks/use-theme';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';
export const Route = createFileRoute('/_unauthenticated/auth/setup-password')({
  validateSearch: (search) => ({
    token: search.token ?? '',
  }),
  component: SetupPasswordPage,
});
function SetupPasswordPage() {
  const { token } = Route.useSearch();
  const { t, locale, setLocale } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    if (password.length < 8) {
      setError(t('auth.passwordMinLength'));
      return;
    }
    if (!token) {
      setError(t('auth.linkExpired'));
      return;
    }
    setIsSubmitting(true);
    try {
      // @ts-expect-error - server function type inference limitation
      const result = await completePasswordSetup({ data: { token, password } });
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  };
  if (success) {
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
            children: t('auth.setupSuccess'),
          }),
          _jsx('p', {
            className: 'mb-6 text-sm text-muted-foreground',
            children: t('auth.setupSuccess'),
          }),
          _jsx(Link, {
            to: '/auth/login',
            children: _jsx(Button, { className: 'w-full', children: t('auth.login') }),
          }),
        ],
      }),
    });
  }
  if (!token) {
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
            children: t('auth.linkExpired'),
          }),
          _jsx('p', {
            className: 'mb-6 text-sm text-muted-foreground',
            children: t('auth.linkExpired'),
          }),
          _jsx(Link, {
            to: '/auth/login',
            children: _jsx(Button, { className: 'w-full', children: t('auth.login') }),
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
        _jsx('div', {
          className: 'mb-6 text-center',
          children: _jsx('h1', {
            className: 'font-display text-2xl font-bold text-foreground',
            children: t('auth.setupPassword'),
          }),
        }),
        _jsxs('form', {
          onSubmit: handleSubmit,
          className: 'flex flex-col gap-4',
          children: [
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
                  minLength: 8,
                  autoComplete: 'new-password',
                }),
              ],
            }),
            _jsxs('div', {
              className: 'flex flex-col gap-1.5',
              children: [
                _jsx(Label, { htmlFor: 'confirmPassword', children: t('auth.confirmPassword') }),
                _jsx(Input, {
                  id: 'confirmPassword',
                  type: 'password',
                  value: confirmPassword,
                  onChange: (e) => setConfirmPassword(e.target.value),
                  required: true,
                  autoComplete: 'new-password',
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
