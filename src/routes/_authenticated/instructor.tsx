import { createFileRoute, Outlet } from '@tanstack/react-router';
import { requireRole } from '../../server/auth';
import { InstructorSidebar } from '../../components/layout/instructor-sidebar';
import { LanguageSwitcher } from '../../components/layout/language-switcher';
import { useI18n } from '../__root';
import { useState } from 'react';
import { NotificationBadge } from '../../components/notifications/NotificationBadge';
import { NotificationCenter } from '../../components/notifications/NotificationCenter';

export const Route = createFileRoute('/_authenticated/instructor')({
  beforeLoad: async () => {
    await requireRole(['instructor']);
  },
  component: InstructorLayout,
});

function InstructorLayout() {
  const { locale, setLocale } = useI18n();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <InstructorSidebar />
      <main className="flex-1 flex flex-col p-6 overflow-x-auto">
        <div className="flex items-center justify-end mb-6 gap-4">
          <NotificationBadge onOpen={() => setIsNotificationOpen(true)} />
          <LanguageSwitcher currentLocale={locale} onSwitch={setLocale} />
        </div>
        <div className="flex-1 flex flex-col gap-6">
          <Outlet />
        </div>
      </main>
      <NotificationCenter
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
      />
    </div>
  );
}
