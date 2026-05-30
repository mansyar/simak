import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { authClient } from '../../../lib/auth-client';
import { useI18n } from '../../__root';
import { ThemeToggle } from '../../../components/layout/theme-toggle';
import { useTheme } from '../../../hooks/use-theme';

export const Route = createFileRoute('/_unauthenticated/auth/login')({
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message ?? t('auth.invalidCredentials'));
      } else {
        // Check if 2FA redirect is required
        const data = result.data as { twoFactorRedirect?: boolean } | undefined;
        if (data?.twoFactorRedirect) {
          router.navigate({ to: '/auth/verify-2fa' as never });
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

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div id="main-content" className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex justify-end mb-2">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
        <h1 className="mb-6 text-center text-2xl font-bold text-foreground">{t('app.name')}</h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">{t('auth.signIn')}</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-foreground">
              {t('auth.email')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-required="true"
              aria-describedby={error ? 'login-error' : undefined}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={t('common.emailPlaceholder')}
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-foreground">
              {t('auth.password')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-required="true"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={t('auth.password')}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div
              id="login-error"
              className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? t('common.loading') : t('auth.signIn')}
          </button>

          <div className="text-center">
            <a href="/auth/forgot-password" className="text-sm text-primary hover:underline">
              {t('auth.forgotPassword')}
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
