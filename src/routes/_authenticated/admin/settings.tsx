import { createFileRoute } from '@tanstack/react-router';
import { useI18n } from '@/routes/__root';
import { SettingsPage } from '@/components/settings/SettingsPage';

export const Route = createFileRoute('/_authenticated/admin/settings')({
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('settings.title')}</h1>
      </div>
      <SettingsPage />
    </div>
  );
}
