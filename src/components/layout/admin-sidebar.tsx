import { useLocation, Link } from '@tanstack/react-router';
import { useI18n } from '../../routes/__root';

export function AdminSidebar() {
  const { pathname } = useLocation();
  const { t } = useI18n();

  const links = [
    { to: '/admin/dashboard', label: 'adminSidebar.dashboard' },
    { to: '/admin/users', label: 'adminSidebar.users' },
    { to: '/admin/templates', label: 'adminSidebar.templates' },
  ] as const;

  return (
    <aside className="flex w-64 flex-col border-r bg-card p-4">
      <nav className="flex flex-col gap-1">
        {links.map((link) => {
          const isActive = pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to as unknown as '.'}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
              }`}
            >
              {t(link.label)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
