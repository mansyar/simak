import { useRouter, useMatchRoute } from '@tanstack/react-router';
import { useI18n } from '@/routes/__root';
import { Menu, Settings, LogOut, ChevronDown } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { ThemeToggle } from './theme-toggle';
import { LanguageSwitcher } from './language-switcher';
import { NotificationBadge } from '../notifications/NotificationBadge';
import { useTheme } from '@/hooks/use-theme';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { KeyboardCheatSheet } from '@/components/keyboard-cheat-sheet';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';

interface AppHeaderProps {
  onMenuToggle: () => void;
  onNotificationOpen: () => void;
  isMenuOpen?: boolean;
}

export function AppHeader({
  onMenuToggle,
  onNotificationOpen,
  isMenuOpen = false,
}: AppHeaderProps) {
  const { t, locale, setLocale } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const { data: sessionData } = authClient.useSession();
  const user = sessionData?.user;

  const { cheatSheetOpen, setCheatSheetOpen } = useKeyboardShortcuts();
  const matchRoute = useMatchRoute();
  const reviewMatch = matchRoute({
    to: '/instructor/reviews/$submissionId',
  });

  const handleLogout = async () => {
    await authClient.signOut();
    router.invalidate();
  };

  // Better Auth includes role via additionalFields, but types may not reflect it
  const userRole = (user as { role?: string } | undefined)?.role || 'student';
  const settingsPath = userRole === 'superadmin' ? '/admin/settings' : `/${userRole}/settings`;

  const avatarLetter =
    user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?';

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-md">
      {/* Left: hamburger menu (mobile only) */}
      <button
        id="mobile-menu-trigger"
        type="button"
        onClick={onMenuToggle}
        className="rounded-md p-2 min-h-11 min-w-11 text-muted-foreground hover:bg-accent hover:text-accent-foreground lg:hidden"
        aria-label={t('common.openMenu')}
        aria-expanded={isMenuOpen}
        aria-controls="mobile-navigation-drawer"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* Spacer on desktop so right-aligned items stay right */}
      <div className="hidden lg:block" />

      {/* Right: actions */}
      <div className="flex items-center gap-3">
        <NotificationBadge onOpen={onNotificationOpen} />
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <LanguageSwitcher currentLocale={locale} onSwitch={setLocale} />

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {avatarLetter}
              </div>
              <ChevronDown className="hidden h-4 w-4 sm:block" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium text-foreground">{user.name || 'User'}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email || ''}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.navigate({ to: settingsPath } as never)}>
                <Settings className="h-4 w-4" />
                {t('nav.settings')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
                {t('auth.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <KeyboardCheatSheet
        isOpen={cheatSheetOpen}
        onClose={() => setCheatSheetOpen(false)}
        isReviewPage={!!reviewMatch}
      />
    </header>
  );
}
