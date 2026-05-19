import { createFileRoute, redirect, Outlet } from '@tanstack/react-router';
import { getSessionFromHeaders } from '../server/auth';
import { LanguageSwitcher } from '../components/layout/language-switcher';
import { useI18n } from './__root';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    const session = await getSessionFromHeaders();
    if (!session) {
      throw redirect({ to: '/auth/login' as unknown as '.' });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="relative min-h-screen">
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher currentLocale={locale} onSwitch={setLocale} />
      </div>
      <Outlet />
    </div>
  );
}
