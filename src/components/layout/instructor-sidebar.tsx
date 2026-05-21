import { useLocation, Link } from '@tanstack/react-router';
import { useI18n } from '../../routes/__root';
import { LayoutDashboard, ClipboardList } from 'lucide-react';

export function InstructorSidebar() {
  const { pathname } = useLocation();
  const { t } = useI18n();

  const links = [
    { to: '/dashboard', label: 'nav.dashboard', icon: LayoutDashboard },
    { to: '/instructor/assignments', label: 'nav.assignments', icon: ClipboardList },
  ] as const;

  return (
    <aside className="flex w-64 flex-col border-r bg-card p-4 shadow-sm">
      <div className="mb-6 px-3 py-2 text-xl font-bold text-foreground tracking-tight">
        SIMAK Instructor
      </div>
      <nav className="flex flex-col gap-1.5">
        {links.map((link) => {
          const isActive = pathname === link.to || pathname.startsWith(link.to + '/');
          const Icon = link.icon;
          return (
            <Link
              key={link.to}
              to={link.to as any}
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
    </aside>
  );
}
