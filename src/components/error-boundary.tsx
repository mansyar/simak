import { useEffect } from 'react';
import { useI18n } from '@/routes/__root';
import { Button } from '@/components/ui/button';
import { logError } from '@/lib/errors';

export function RootErrorComponent({ error }: { error: Error }) {
  const { t } = useI18n();

  useEffect(() => {
    logError('INTERNAL', error.message, {
      cause: error,
      handler: 'RootErrorComponent',
    });
  }, [error]);

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 p-4"
      role="alert"
      aria-live="assertive"
    >
      <h1 className="text-4xl font-bold text-foreground">{t('error.somethingWentWrong')}</h1>
      <p className="text-lg text-muted-foreground text-balance text-center">
        {t('error.errorBoundaryDescription')}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button type="button" onClick={handleReload}>
          {t('error.reload')}
        </Button>
        <a
          href="/dashboard"
          className="inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t('common.goToDashboard')}
        </a>
      </div>
    </div>
  );
}
