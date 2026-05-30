import { createFileRoute, Outlet } from '@tanstack/react-router';
import { requireRole } from '../../server/auth';
import { AdminSidebar } from '../../components/layout/admin-sidebar';
import { LanguageSwitcher } from '../../components/layout/language-switcher';
import { ThemeToggle } from '../../components/layout/theme-toggle';
import { useI18n } from '../__root';
import { useState } from 'react';
import { NotificationBadge } from '../../components/notifications/NotificationBadge';
import { NotificationCenter } from '../../components/notifications/NotificationCenter';
import { useTheme } from '../../hooks/use-theme';
import { Menu } from 'lucide-react';

export const Route = createFileRoute('/_authenticated/admin')({
  beforeLoad: async () => {
    await requireRole(['superadmin', 'admin']);
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { t, locale, setLocale } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AdminSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
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
        <Outlet />
      </main>
      <NotificationCenter
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
      />
    </div>
  );
}
