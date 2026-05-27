import { createFileRoute } from '@tanstack/react-router';
import { useI18n } from './__root';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const { t } = useI18n();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-4xl font-bold text-foreground">{t('app.name')}</h1>
      <p className="text-lg text-muted-foreground">{t('app.tagline')}</p>
      <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
    </div>
  );
}
