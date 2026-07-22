import { useLocation, Link, useRouter } from '@tanstack/react-router';
import { useI18n } from '../../routes/__root';
import {
  LayoutDashboard,
  ClipboardList,
  ClipboardCheck,
  Settings,
  LogOut,
  X,
  GraduationCap,
} from 'lucide-react';
import { authClient } from '../../lib/auth-client';

interface InstructorSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InstructorSidebar({ isOpen, onClose }: InstructorSidebarProps) {
  const { pathname } = useLocation();
  const { t } = useI18n();
  const router = useRouter();
  const { data: sessionData } = authClient.useSession();
  const user = sessionData?.user;

  const mainLinks = [
    { to: '/instructor/dashboard', label: 'instructorSidebar.dashboard', icon: LayoutDashboard },
    { to: '/instructor/assignments', label: 'instructorSidebar.assignments', icon: ClipboardList },
    { to: '/instructor/reviews', label: 'instructorSidebar.reviews', icon: ClipboardCheck },
  ] as const;

  const preferenceLinks = [
    { to: '/instructor/settings', label: 'nav.settings', icon: Settings },
  ] as const;

  const handleLogout = async () => {
    await authClient.signOut();
    router.invalidate();
  };

  const handleLinkClick = () => {
    onClose();
  };

  const isActiveLink = (to: string) => pathname === to || pathname.startsWith(to + '/');

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-sidebar-border bg-sidebar shadow-lg transition-transform duration-200 ease-in-out lg:sticky lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Branding */}
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="text-lg font-display font-bold tracking-tight text-sidebar-primary-foreground">
              {t('instructorSidebar.branding')}
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring lg:hidden"
            aria-label={t('common.closeMenu')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-4 pb-4">
          {/* MAIN section */}
          <span className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
            {t('instructorSidebar.sectionMain')}
          </span>
          {mainLinks.map((link) => {
            const isActive = isActiveLink(link.to);
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to as unknown as '.'}
                onClick={handleLinkClick}
                preload="intent"
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-primary-foreground'
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                {t(link.label)}
              </Link>
            );
          })}

          {/* PREFERENCES section */}
          <span className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
            {t('instructorSidebar.sectionPreferences')}
          </span>
          {preferenceLinks.map((link) => {
            const isActive = isActiveLink(link.to);
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to as unknown as '.'}
                onClick={handleLinkClick}
                preload="intent"
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-primary-foreground'
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                {t(link.label)}
              </Link>
            );
          })}
        </nav>

        {/* User card */}
        {user && (
          <div className="mx-4 mb-2 rounded-lg bg-sidebar-accent/30 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
                {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-sidebar-primary-foreground">
                  {user.name || 'User'}
                </p>
                <p className="truncate text-xs text-sidebar-foreground">{user.email || ''}</p>
              </div>
            </div>
          </div>
        )}

        {/* Logout */}
        <div className="border-t border-sidebar-border p-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            {t('auth.logout')}
          </button>
        </div>
      </aside>
    </>
  );
}
