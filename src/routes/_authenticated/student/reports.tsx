import { createFileRoute } from '@tanstack/react-router';
import { ReportCatalogControls } from '@/components/reporting/ReportCatalogControls';

export const Route = createFileRoute('/_authenticated/student/reports')({
  component: StudentReportsPage,
});

function StudentReportsPage() {
  return (
    <div className="space-y-6">
      <ReportCatalogControls role="student" />
    </div>
  );
}
