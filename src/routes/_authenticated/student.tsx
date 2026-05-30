import { createFileRoute, Outlet } from '@tanstack/react-router';
import { requireRole } from '../../server/auth';
import { StudentSidebar } from '../../components/layout/student-sidebar';
import { LanguageSwitcher } from '../../components/layout/language-switcher';
import { ThemeToggle } from '../../components/layout/theme-toggle';
import { useI18n } from '../__root';
import { useState } from 'react';
import { NotificationBadge } from '../../components/notifications/NotificationBadge';
import { NotificationCenter } from '../../components/notifications/NotificationCenter';
import { useTheme } from '../../hooks/use-theme';
import { Menu } from 'lucide-react';

export const Route = createFileRoute('/_authenticated/student')({
  beforeLoad: async () => {
    await requireRole(['student']);
  },
  component: StudentLayout,
});

function StudentLayout() {
  const { t, locale, setLocale } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <StudentSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <main className="flex-1 flex flex-col p-6 overflow-x-auto lg:pl-64">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="rounded-md p-2 min-h-11 min-w-11 text-muted-foreground hover:bg-accent hover:text-accent-foreground lg:hidden"
            aria-label={t('common.openMenu')}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-4">
            <NotificationBadge onOpen={() => setIsNotificationOpen(true)} />
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <LanguageSwitcher currentLocale={locale} onSwitch={setLocale} />
          </div>
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
