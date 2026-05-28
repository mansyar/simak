import { useLocation, Link, useRouter } from '@tanstack/react-router';
import { useI18n } from '../../routes/__root';
import { LayoutDashboard, ClipboardList, ClipboardCheck, LogOut, X } from 'lucide-react';
import { authClient } from '../../lib/auth-client';

interface InstructorSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InstructorSidebar({ isOpen, onClose }: InstructorSidebarProps) {
  const { pathname } = useLocation();
  const { t } = useI18n();
  const router = useRouter();

  const links = [
    { to: '/instructor/dashboard', label: 'nav.dashboard', icon: LayoutDashboard },
    { to: '/instructor/assignments', label: 'nav.assignments', icon: ClipboardList },
    { to: '/instructor/reviews', label: 'nav.reviews', icon: ClipboardCheck },
  ] as const;

  const handleLogout = async () => {
    await authClient.signOut();
    router.invalidate();
  };

  const handleLinkClick = () => {
    onClose();
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-card shadow-sm transition-transform duration-200 ease-in-out lg:sticky lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-5">
          <span className="text-xl font-bold text-foreground tracking-tight">
            {t('nav.branding_instructor')}
          </span>
          <button
            onClick={onClose}
            className="rounded-md p-1 min-h-11 min-w-11 text-muted-foreground hover:bg-accent hover:text-accent-foreground lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-3 pb-4">
          {links.map((link) => {
            const isActive = pathname === link.to || pathname.startsWith(link.to + '/');
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to as any}
                onClick={handleLinkClick}
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
    </>
  );
}
