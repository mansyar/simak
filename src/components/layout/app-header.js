import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { useRouter } from '@tanstack/react-router';
import { useI18n } from '@/routes/__root';
import { Menu, Settings, LogOut, ChevronDown } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { ThemeToggle } from './theme-toggle';
import { LanguageSwitcher } from './language-switcher';
import { NotificationBadge } from '../notifications/NotificationBadge';
import { useTheme } from '@/hooks/use-theme';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';
export function AppHeader({ onMenuToggle, onNotificationOpen }) {
  const { t, locale, setLocale } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const { data: sessionData } = authClient.useSession();
  const user = sessionData?.user;
  const handleLogout = async () => {
    await authClient.signOut();
    router.invalidate();
  };
  // Better Auth includes role via additionalFields, but types may not reflect it
  const userRole = user?.role || 'student';
  const settingsPath = userRole === 'superadmin' ? '/admin/settings' : `/${userRole}/settings`;
  const avatarLetter =
    user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?';
  return _jsxs('header', {
    className:
      'sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-md',
    children: [
      _jsx('button', {
        onClick: onMenuToggle,
        className:
          'rounded-md p-2 min-h-11 min-w-11 text-muted-foreground hover:bg-accent hover:text-accent-foreground lg:hidden',
        'aria-label': t('common.openMenu'),
        children: _jsx(Menu, { className: 'h-5 w-5' }),
      }),
      _jsx('div', { className: 'hidden lg:block' }),
      _jsxs('div', {
        className: 'flex items-center gap-3',
        children: [
          _jsx(NotificationBadge, { onOpen: onNotificationOpen }),
          _jsx(ThemeToggle, { theme: theme, onToggle: toggleTheme }),
          _jsx(LanguageSwitcher, { currentLocale: locale, onSwitch: setLocale }),
          user &&
            _jsxs(DropdownMenu, {
              children: [
                _jsxs(DropdownMenuTrigger, {
                  className:
                    'flex items-center gap-2 rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  children: [
                    _jsx('div', {
                      className:
                        'flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground',
                      children: avatarLetter,
                    }),
                    _jsx(ChevronDown, { className: 'hidden h-4 w-4 sm:block' }),
                  ],
                }),
                _jsxs(DropdownMenuContent, {
                  align: 'end',
                  className: 'w-56',
                  children: [
                    _jsxs('div', {
                      className: 'px-2 py-1.5',
                      children: [
                        _jsx('p', {
                          className: 'text-sm font-medium text-foreground',
                          children: user.name || 'User',
                        }),
                        _jsx('p', {
                          className: 'truncate text-xs text-muted-foreground',
                          children: user.email || '',
                        }),
                      ],
                    }),
                    _jsx(DropdownMenuSeparator, {}),
                    _jsxs(DropdownMenuItem, {
                      onClick: () => router.navigate({ to: settingsPath }),
                      children: [_jsx(Settings, { className: 'h-4 w-4' }), t('nav.settings')],
                    }),
                    _jsx(DropdownMenuSeparator, {}),
                    _jsxs(DropdownMenuItem, {
                      variant: 'destructive',
                      onClick: handleLogout,
                      children: [_jsx(LogOut, { className: 'h-4 w-4' }), t('auth.logout')],
                    }),
                  ],
                }),
              ],
            }),
        ],
      }),
    ],
  });
}
