import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { createFileRoute } from '@tanstack/react-router';
import { useI18n } from '@/routes/__root';
import { SettingsPage } from '@/components/settings/SettingsPage';
export const Route = createFileRoute('/_authenticated/student/settings')({
  component: StudentSettingsPage,
});
function StudentSettingsPage() {
  const { t } = useI18n();
  return _jsxs('div', {
    className: 'space-y-6',
    children: [
      _jsx('div', {
        children: _jsx('h1', {
          className: 'text-3xl font-bold tracking-tight text-foreground',
          children: t('settings.title'),
        }),
      }),
      _jsx(SettingsPage, {}),
    ],
  });
}
