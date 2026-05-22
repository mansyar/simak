import { createFileRoute, Outlet } from '@tanstack/react-router';
import { requireRole } from '../../server/auth';
import { StudentSidebar } from '../../components/layout/student-sidebar';
import { LanguageSwitcher } from '../../components/layout/language-switcher';
import { useI18n } from '../__root';

export const Route = createFileRoute('/_authenticated/student')({
  beforeLoad: async () => {
    await requireRole(['student']);
  },
  component: StudentLayout,
});

function StudentLayout() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="flex min-h-screen bg-background">
      <StudentSidebar />
      <main className="flex-1 flex flex-col p-6 overflow-x-auto">
        <div className="flex items-center justify-end mb-6">
          <LanguageSwitcher currentLocale={locale} onSwitch={setLocale} />
        </div>
        <div className="flex-1 flex flex-col gap-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
