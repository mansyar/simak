import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { requireRole } from '../../server/auth';
import { InstructorSidebar } from '../../components/layout/instructor-sidebar';
import { AppHeader } from '../../components/layout/app-header';
import { useState } from 'react';
import { NotificationCenter } from '../../components/notifications/NotificationCenter';
export const Route = createFileRoute('/_authenticated/instructor')({
  beforeLoad: async () => {
    await requireRole(['instructor']);
  },
  component: InstructorLayout,
});
function InstructorLayout() {
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  return _jsxs('div', {
    className: 'flex h-screen bg-background overflow-hidden',
    children: [
      _jsx(InstructorSidebar, { isOpen: isSidebarOpen, onClose: () => setIsSidebarOpen(false) }),
      _jsxs('div', {
        className: 'flex flex-1 flex-col overflow-hidden',
        children: [
          _jsx(AppHeader, {
            onMenuToggle: () => setIsSidebarOpen(true),
            onNotificationOpen: () => setIsNotificationOpen(true),
          }),
          _jsx('main', {
            className: 'flex-1 overflow-y-auto p-6',
            children: _jsx('div', { className: 'flex flex-col gap-6', children: _jsx(Outlet, {}) }),
          }),
        ],
      }),
      _jsx(NotificationCenter, {
        isOpen: isNotificationOpen,
        onClose: () => setIsNotificationOpen(false),
      }),
    ],
  });
}
