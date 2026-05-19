import { createFileRoute, useRouter } from '@tanstack/react-router';
import { authClient } from '../../lib/auth-client';
import { useI18n } from '../__root';

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
});

function DashboardPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { t } = useI18n();

  const handleLogout = async () => {
    await authClient.signOut();
    router.invalidate();
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session?.user as any;
  const role = (user?.role ?? 'student') as string;
  const displayName = user?.name ?? 'User';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <h1 className="text-3xl font-bold text-foreground">
        {t('nav.welcome').replace('{name}', displayName)}
      </h1>
      <p className="text-lg text-muted-foreground">{t('nav.role_' + role)}</p>
      <nav className="flex flex-col gap-2">
        <a href="/assignments" className="text-primary hover:underline">
          {t('nav.assignments')}
        </a>
        <a href="/consultations" className="text-primary hover:underline">
          {t('nav.consultations')}
        </a>
        <a href="/settings" className="text-primary hover:underline">
          {t('nav.settings')}
        </a>
      </nav>
      <button
        onClick={handleLogout}
        className="rounded bg-destructive px-4 py-2 font-medium text-destructive-foreground hover:bg-destructive/90"
      >
        {t('auth.logout')}
      </button>
    </div>
  );
}
