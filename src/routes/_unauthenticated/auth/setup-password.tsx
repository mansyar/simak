import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { completePasswordSetup } from '../../../server/setup-password';
import { useI18n } from '../../__root';

export const Route = createFileRoute('/_unauthenticated/auth/setup-password')({
  validateSearch: (search: Record<string, string | undefined>) => ({
    token: search.token ?? '',
  }),
  component: SetupPasswordPage,
});

function SetupPasswordPage() {
  const { token } = Route.useSearch();
  const { t } = useI18n();
  const router = useRouter();
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
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-lg border bg-card p-6 text-center shadow-sm">
          <h1 className="mb-4 text-2xl font-bold text-foreground">{t('auth.setupSuccess')}</h1>
          <p className="mb-6 text-sm text-muted-foreground">{t('auth.setupSuccess')}</p>
          <Link
            to="/auth/login"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t('auth.login')}
          </Link>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-lg border bg-card p-6 text-center shadow-sm">
          <h1 className="mb-4 text-2xl font-bold text-foreground">{t('auth.linkExpired')}</h1>
          <p className="mb-6 text-sm text-muted-foreground">{t('auth.linkExpired')}</p>
          <Link
            to="/auth/login"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t('auth.login')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="mb-2 text-center text-2xl font-bold text-foreground">
          {t('auth.setupPassword')}
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              minLength={8}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              {t('auth.confirmPassword')}
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? t('common.loading') : t('common.submit')}
          </button>

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
