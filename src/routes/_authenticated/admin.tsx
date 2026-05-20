import { createFileRoute, Outlet } from '@tanstack/react-router';
import { requireRole } from '../../server/auth';
import { AdminSidebar } from '../../components/layout/admin-sidebar';
import { LanguageSwitcher } from '../../components/layout/language-switcher';
import { useI18n } from '../__root';

export const Route = createFileRoute('/_authenticated/admin')({
  beforeLoad: async () => {
    await requireRole(['superadmin', 'admin']);
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-6">
        <div className="flex items-center justify-end mb-4">
          <LanguageSwitcher currentLocale={locale} onSwitch={setLocale} />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
