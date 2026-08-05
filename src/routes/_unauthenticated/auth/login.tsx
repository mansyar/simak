import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { authClient } from '../../../lib/auth-client';
import { useI18n } from '../../__root';
import { ThemeToggle } from '../../../components/layout/theme-toggle';
import { LanguageSwitcher } from '../../../components/layout/language-switcher';
import { useTheme } from '../../../hooks/use-theme';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { buttonVariants } from '../../../components/ui/button';
import { RefreshCcw } from 'lucide-react';
import { cn } from '../../../lib/utils';

export const Route = createFileRoute('/_unauthenticated/auth/login')({
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setEmailError(null);
    setPasswordError(null);

    let hasValidationError = false;
    if (!email.trim()) {
      setEmailError(t('auth.emailRequired'));
      hasValidationError = true;
    } else if (!email.includes('@')) {
      setEmailError(t('auth.invalidEmail'));
      hasValidationError = true;
    }
    if (!password) {
      setPasswordError(t('auth.passwordRequired'));
      hasValidationError = true;
    }
    if (hasValidationError) return;

    setIsSubmitting(true);

    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(t('auth.invalidCredentials'));
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
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-lg">
        <div className="mb-6 flex items-center justify-between">
          <LanguageSwitcher currentLocale={locale} onSwitch={setLocale} />
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>

        <div className="mb-6 text-center">
          <h1 className="font-display text-3xl font-bold text-foreground">🎓 SIMAK</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('auth.signIn')}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-required="true"
              aria-describedby={emailError ? 'email-error' : error ? 'login-error' : undefined}
              aria-invalid={emailError ? 'true' : undefined}
              placeholder={t('common.emailPlaceholder')}
              autoComplete="email"
            />
            {emailError && (
              <p id="email-error" className="text-sm text-destructive" role="alert">
                {emailError}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-required="true"
              aria-describedby={
                passwordError ? 'password-error' : error ? 'login-error' : undefined
              }
              aria-invalid={passwordError ? 'true' : undefined}
              placeholder={t('auth.password')}
              autoComplete="current-password"
            />
            {passwordError && (
              <p id="password-error" className="text-sm text-destructive" role="alert">
                {passwordError}
              </p>
            )}
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
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className={cn(buttonVariants(), 'w-full')}
          >
            {isSubmitting && (
              <RefreshCcw className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
          </button>

          <div className="text-center">
            <a
              href="/auth/forgot-password"
              className="inline-flex min-h-11 items-center text-sm text-primary hover:underline"
            >
              {t('auth.forgotPassword')}
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
