import { createFileRoute } from '@tanstack/react-router';
import { useI18n } from '@/routes/__root';
import { SettingsPage } from '@/components/settings/SettingsPage';
import { PageHeader } from '@/components/ui/page-header';

export const Route = createFileRoute('/_authenticated/admin/settings')({
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <PageHeader title={t('settings.title')} />
      <SettingsPage />
    </div>
  );
}
