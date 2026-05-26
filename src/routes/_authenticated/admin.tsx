import { createFileRoute, Outlet } from '@tanstack/react-router';
import { requireRole } from '../../server/auth';
import { AdminSidebar } from '../../components/layout/admin-sidebar';
import { LanguageSwitcher } from '../../components/layout/language-switcher';
import { useI18n } from '../__root';
import { useState } from 'react';
import { NotificationBadge } from '../../components/notifications/NotificationBadge';
import { NotificationCenter } from '../../components/notifications/NotificationCenter';

export const Route = createFileRoute('/_authenticated/admin')({
  beforeLoad: async () => {
    await requireRole(['superadmin', 'admin']);
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { locale, setLocale } = useI18n();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-6">
        <div className="flex items-center justify-end mb-4 gap-4">
          <NotificationBadge onOpen={() => setIsNotificationOpen(true)} />
          <LanguageSwitcher currentLocale={locale} onSwitch={setLocale} />
        </div>
        <Outlet />
      </main>
      <NotificationCenter
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
      />
    </div>
  );
}
