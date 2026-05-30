import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { authClient } from '../../../lib/auth-client';
import { useI18n } from '../../__root';

export const Route = createFileRoute('/_unauthenticated/auth/verify-backup-code')({
  component: VerifyBackupCodePage,
});

function VerifyBackupCodePage() {
  const router = useRouter();
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await authClient.twoFactor.verifyBackupCode({
        code,
        trustDevice: false,
      });

      if (result.error) {
        setError(result.error.message ?? t('auth.invalidBackupCode'));
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
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="mb-2 text-center text-2xl font-bold text-foreground">
          {t('auth.verifyBackupCode')}
        </h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          {t('auth.verifyBackupCodeDescription')}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="backup-code" className="mb-1 block text-sm font-medium text-foreground">
              {t('auth.backupCode')}
            </label>
            <input
              id="backup-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="xxxx-xxxx-xxxx"
              autoComplete="off"
              autoFocus
            />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || code.length < 1}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? t('common.loading') : t('common.verify')}
          </button>

          <div className="flex flex-col items-center gap-2 text-center">
            <Link to="/auth/verify-2fa" className="text-sm text-primary hover:underline">
              {t('auth.useTotpCode')}
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
