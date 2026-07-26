import { createFileRoute, Outlet } from '@tanstack/react-router';
import { requireRole } from '../../server/auth';
import { InstructorSidebar } from '../../components/layout/instructor-sidebar';
import { AppHeader } from '../../components/layout/app-header';
import { useState } from 'react';
import { NotificationCenter } from '../../components/notifications/NotificationCenter';

export const Route = createFileRoute('/_authenticated/instructor')({
  beforeLoad: async () => {
    await requireRole(['instructor', 'admin', 'superadmin']);
  },
  component: InstructorLayout,
});

function InstructorLayout() {
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <InstructorSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader
          onMenuToggle={() => setIsSidebarOpen(true)}
          onNotificationOpen={() => setIsNotificationOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col gap-6">
            <Outlet />
          </div>
        </main>
      </div>
      <NotificationCenter
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
      />
    </div>
  );
}
