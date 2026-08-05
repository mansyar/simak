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
  validateSearch: (search: Record<string, string | undefined>) => ({
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
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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
      const result = await completePasswordSetup({ data: { token, password } });
      if ('error' in result) {
        setError(t('auth.linkExpired'));
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div
          role="status"
          aria-live="polite"
          className="w-full max-w-sm rounded-xl border bg-card p-8 text-center shadow-lg"
        >
          <div className="mb-6 flex items-center justify-between">
            <LanguageSwitcher currentLocale={locale} onSwitch={setLocale} />
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
          <h1 className="mb-2 font-display text-2xl font-bold text-foreground">
            {t('auth.setupSuccess')}
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">{t('auth.setupSuccess')}</p>
          <Link to="/auth/login">
            <Button className="w-full min-h-11">{t('auth.login')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm rounded-xl border bg-card p-8 text-center shadow-lg">
          <div className="mb-6 flex items-center justify-between">
            <LanguageSwitcher currentLocale={locale} onSwitch={setLocale} />
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
          <h1 className="mb-2 font-display text-2xl font-bold text-foreground">
            {t('auth.linkExpired')}
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">{t('auth.linkExpired')}</p>
          <Link to="/auth/login">
            <Button className="w-full min-h-11">{t('auth.login')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-lg">
        <div className="mb-6 flex items-center justify-between">
          <LanguageSwitcher currentLocale={locale} onSwitch={setLocale} />
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>

        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl font-bold text-foreground">
            {t('auth.setupPassword')}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            loading={isSubmitting}
            aria-busy={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? t('common.loading') : t('common.submit')}
          </Button>

          <div className="text-center">
            <Link
              to="/auth/login"
              className="inline-flex min-h-11 items-center text-sm text-primary hover:underline"
            >
              {t('common.back')}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
