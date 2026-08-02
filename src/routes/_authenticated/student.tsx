import { createFileRoute, Outlet } from '@tanstack/react-router';
import { requireRole } from '../../server/auth';
import { StudentSidebar } from '../../components/layout/student-sidebar';
import { AppHeader } from '../../components/layout/app-header';
import { useState } from 'react';
import { NotificationCenter } from '../../components/notifications/NotificationCenter';
import { StudentTimezoneProvider } from '../../hooks/use-student-timezone';

export const Route = createFileRoute('/_authenticated/student')({
  beforeLoad: async () => {
    await requireRole(['student']);
  },
  component: StudentLayout,
});

function StudentLayout() {
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <StudentSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader
          onMenuToggle={() => setIsSidebarOpen(true)}
          onNotificationOpen={() => setIsNotificationOpen(true)}
        />
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto p-6">
          <StudentTimezoneProvider>
            <div className="flex flex-col gap-6">
              <Outlet />
            </div>
          </StudentTimezoneProvider>
        </main>
      </div>
      <NotificationCenter
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
      />
    </div>
  );
}
