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
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-lg">
        <div className="mb-6 flex items-center justify-between">
          <LanguageSwitcher currentLocale={locale} onSwitch={setLocale} />
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>

        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl font-bold text-foreground">
            {t('auth.verifyTwoFactor')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('auth.verifyTwoFactorDescription')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="code">{t('auth.totpCode')}</Label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
              placeholder="000000"
              autoComplete="one-time-code"
              autoFocus
            />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={isSubmitting || code.length < 6}
            loading={isSubmitting}
            className="w-full"
          >
            {t('common.verify')}
          </Button>

          <div className="flex flex-col items-center gap-2 text-center">
            <Link to="/auth/verify-backup-code" className="text-sm text-primary hover:underline">
              {t('auth.useBackupCode')}
            </Link>
            <Link to="/auth/login" className="text-sm text-muted-foreground hover:underline">
              {t('common.back')}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
