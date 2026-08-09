import { createFileRoute } from '@tanstack/react-router';
import { ReportCatalogControls } from '@/components/reporting/ReportCatalogControls';

export const Route = createFileRoute('/_authenticated/admin/reports')({
  component: AdminReportsPage,
});

function AdminReportsPage() {
  return (
    <div className="space-y-6">
      <ReportCatalogControls role="admin" />
    </div>
  );
}
