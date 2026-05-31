import { createFileRoute, Outlet } from '@tanstack/react-router';
import { requireRole } from '../../server/auth';
import { AdminSidebar } from '../../components/layout/admin-sidebar';
import { AppHeader } from '../../components/layout/app-header';
import { useI18n } from '../__root';
import { useState } from 'react';
import { NotificationCenter } from '../../components/notifications/NotificationCenter';

export const Route = createFileRoute('/_authenticated/admin')({
  beforeLoad: async () => {
    await requireRole(['superadmin', 'admin']);
  },
  component: AdminLayout,
});

function AdminLayout() {
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AdminSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader
          onMenuToggle={() => setIsSidebarOpen(true)}
          onNotificationOpen={() => setIsNotificationOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <NotificationCenter
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
      />
    </div>
  );
}
