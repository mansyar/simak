import { createFileRoute } from '@tanstack/react-router';
import { useI18n } from '@/routes/__root';
import { TwoFactorSettings } from '@/components/settings/TwoFactorSettings';

export const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useI18n();

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <h1 className="mb-8 text-2xl font-bold">{t('settings.title')}</h1>
      <TwoFactorSettings />
    </div>
  );
}
