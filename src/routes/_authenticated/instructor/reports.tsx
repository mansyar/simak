import { createFileRoute } from '@tanstack/react-router';
import { ReportCatalogControls } from '@/components/reporting/ReportCatalogControls';

export const Route = createFileRoute('/_authenticated/instructor/reports')({
  component: InstructorReportsPage,
});

function InstructorReportsPage() {
  return (
    <div className="space-y-6">
      <ReportCatalogControls role="instructor" />
    </div>
  );
}
