import { useLocation, Link, useRouter } from '@tanstack/react-router';
import { useI18n } from '../../routes/__root';
import { LayoutDashboard, Users, FileType, LogOut } from 'lucide-react';
import { authClient } from '../../lib/auth-client';

export function AdminSidebar() {
  const { pathname } = useLocation();
  const { t } = useI18n();
  const router = useRouter();

  const links = [
    { to: '/admin/dashboard', label: 'adminSidebar.dashboard', icon: LayoutDashboard },
    { to: '/admin/users', label: 'adminSidebar.users', icon: Users },
    { to: '/admin/templates', label: 'adminSidebar.templates', icon: FileType },
  ] as const;

  const handleLogout = async () => {
    await authClient.signOut();
    router.invalidate();
  };

  return (
    <aside className="sticky top-0 flex h-screen w-64 flex-col border-r bg-card shadow-sm">
      <div className="px-4 py-5 text-xl font-bold text-foreground tracking-tight">SIMAK Admin</div>
      <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-3 pb-4">
        {links.map((link) => {
          const isActive = pathname === link.to || pathname.startsWith(link.to + '/');
          const Icon = link.icon;
          return (
            <Link
              key={link.to}
              to={link.to as unknown as '.'}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t(link.label)}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          {t('auth.logout')}
        </button>
      </div>
    </aside>
  );
}
