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
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm rounded-xl border bg-card p-8 text-center shadow-lg">
          <div className="mb-6 flex items-center justify-between">
            <LanguageSwitcher currentLocale={locale} onSwitch={setLocale} />
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
          <h1 className="mb-2 font-display text-2xl font-bold text-foreground">
            {t('auth.checkYourEmail')}
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">{t('auth.forgotPasswordSent')}</p>
          <Link to="/auth/login">
            <Button variant="outline" className="w-full">
              {t('common.back')}
            </Button>
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
            {t('auth.resetPassword')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('auth.forgotPassword')}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder={t('common.emailPlaceholder')}
              autoComplete="email"
            />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {error}
            </div>
          )}

          <Button type="submit" disabled={isSubmitting} loading={isSubmitting} className="w-full">
            {t('common.submit')}
          </Button>

          <div className="text-center">
            <Link to="/auth/login" className="text-sm text-primary hover:underline">
              {t('common.back')}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
