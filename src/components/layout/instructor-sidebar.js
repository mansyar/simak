import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from 'react/jsx-runtime';
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
export function InstructorSidebar({ isOpen, onClose }) {
  const { pathname } = useLocation();
  const { t } = useI18n();
  const router = useRouter();
  const { data: sessionData } = authClient.useSession();
  const user = sessionData?.user;
  const mainLinks = [
    { to: '/instructor/dashboard', label: 'instructorSidebar.dashboard', icon: LayoutDashboard },
    { to: '/instructor/assignments', label: 'instructorSidebar.assignments', icon: ClipboardList },
    { to: '/instructor/reviews', label: 'instructorSidebar.reviews', icon: ClipboardCheck },
  ];
  const preferenceLinks = [{ to: '/instructor/settings', label: 'nav.settings', icon: Settings }];
  const handleLogout = async () => {
    await authClient.signOut();
    router.invalidate();
  };
  const handleLinkClick = () => {
    onClose();
  };
  const isActiveLink = (to) => pathname === to || pathname.startsWith(to + '/');
  return _jsxs(_Fragment, {
    children: [
      isOpen &&
        _jsx('div', { className: 'fixed inset-0 z-40 bg-black/50 lg:hidden', onClick: onClose }),
      _jsxs('aside', {
        className: `fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-sidebar-border bg-sidebar shadow-lg transition-transform duration-200 ease-in-out lg:sticky lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`,
        children: [
          _jsxs('div', {
            className: 'flex items-center justify-between px-5 py-5',
            children: [
              _jsxs('div', {
                className: 'flex items-center gap-3',
                children: [
                  _jsx('div', {
                    className:
                      'flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground',
                    children: _jsx(GraduationCap, { className: 'h-5 w-5' }),
                  }),
                  _jsx('span', {
                    className:
                      'text-lg font-display font-bold tracking-tight text-sidebar-primary-foreground',
                    children: t('instructorSidebar.branding'),
                  }),
                ],
              }),
              _jsx('button', {
                onClick: onClose,
                className:
                  'flex h-11 w-11 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring lg:hidden',
                'aria-label': t('common.closeMenu'),
                children: _jsx(X, { className: 'h-5 w-5' }),
              }),
            ],
          }),
          _jsxs('nav', {
            className: 'flex flex-1 flex-col gap-0.5 overflow-y-auto px-4 pb-4',
            children: [
              _jsx('span', {
                className:
                  'px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/50',
                children: t('instructorSidebar.sectionMain'),
              }),
              mainLinks.map((link) => {
                const isActive = isActiveLink(link.to);
                const Icon = link.icon;
                return _jsxs(
                  Link,
                  {
                    to: link.to,
                    onClick: handleLinkClick,
                    className: `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-primary-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-primary-foreground'
                    }`,
                    children: [
                      _jsx(Icon, { className: 'h-4 w-4 flex-shrink-0', 'aria-hidden': 'true' }),
                      t(link.label),
                    ],
                  },
                  link.to,
                );
              }),
              _jsx('span', {
                className:
                  'px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/50',
                children: t('instructorSidebar.sectionPreferences'),
              }),
              preferenceLinks.map((link) => {
                const isActive = isActiveLink(link.to);
                const Icon = link.icon;
                return _jsxs(
                  Link,
                  {
                    to: link.to,
                    onClick: handleLinkClick,
                    className: `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-primary-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-primary-foreground'
                    }`,
                    children: [
                      _jsx(Icon, { className: 'h-4 w-4 flex-shrink-0', 'aria-hidden': 'true' }),
                      t(link.label),
                    ],
                  },
                  link.to,
                );
              }),
            ],
          }),
          user &&
            _jsx('div', {
              className: 'mx-4 mb-2 rounded-lg bg-sidebar-accent/30 p-3',
              children: _jsxs('div', {
                className: 'flex items-center gap-3',
                children: [
                  _jsx('div', {
                    className:
                      'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground',
                    children:
                      user.name?.charAt(0)?.toUpperCase() ||
                      user.email?.charAt(0)?.toUpperCase() ||
                      '?',
                  }),
                  _jsxs('div', {
                    className: 'min-w-0 flex-1',
                    children: [
                      _jsx('p', {
                        className: 'truncate text-sm font-medium text-sidebar-primary-foreground',
                        children: user.name || 'User',
                      }),
                      _jsx('p', {
                        className: 'truncate text-xs text-sidebar-foreground',
                        children: user.email || '',
                      }),
                    ],
                  }),
                ],
              }),
            }),
          _jsx('div', {
            className: 'border-t border-sidebar-border p-4',
            children: _jsxs('button', {
              onClick: handleLogout,
              className:
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-all hover:bg-destructive/10 hover:text-destructive',
              children: [_jsx(LogOut, { className: 'h-4 w-4' }), t('auth.logout')],
            }),
          }),
        ],
      }),
    ],
  });
}
