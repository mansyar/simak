import { createFileRoute } from '@tanstack/react-router';
import { useI18n } from '@/routes/__root';
import { SettingsPage } from '@/components/settings/SettingsPage';

export const Route = createFileRoute('/_authenticated/instructor/settings')({
  component: InstructorSettingsPage,
});

function InstructorSettingsPage() {
  const { t } = useI18n();

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <h1 className="mb-8 text-2xl font-bold">{t('settings.title')}</h1>
      <SettingsPage />
    </div>
  );
}
