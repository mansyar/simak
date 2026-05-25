import { createFileRoute, Link } from '@tanstack/react-router';
import { getAssignmentDetail } from '@/server/assignments';
import { ProgressTable } from '@/components/instructor/assignments/ProgressTable';
import { DeadlineManager } from '@/components/reviews/DeadlineManager';
import { Calendar, Users, Clipboard, ArrowLeft, Percent, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { useI18n } from '../../../__root';

export const Route = createFileRoute('/_authenticated/instructor/assignments/$id')({
  loader: async ({ params }) => {
    return (getAssignmentDetail as any)({ data: { id: Number((params as any).id) } });
  },
  component: AssignmentDetailPage,
});

function AssignmentDetailPage() {
  const { t } = useI18n();
  const assignment = Route.useLoaderData();

  if (!assignment) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <h2 className="text-xl font-semibold mb-2">{t('error.notFound')}</h2>
        <p className="text-muted-foreground mb-4">
          This assignment could not be found or you do not have permission to view it.
        </p>
        <Link to={'/instructor/assignments' as any} className="text-primary hover:underline">
          {t('common.back')}
        </Link>
      </div>
    );
  }

  // Calculate statistics
  const totalStudents = assignment.students.length;
  const avgProgress =
    totalStudents > 0
      ? Math.round(
          assignment.students.reduce((sum: number, s: any) => sum + s.progressPercent, 0) /
            totalStudents,
        )
      : 0;
  const completedStudents = assignment.students.filter(
    (s: any) => s.progressPercent === 100,
  ).length;

  return (
    <div className="space-y-6">
      {/* Header and Back Link */}
      <div className="flex flex-col gap-4">
        <div>
          <Link
            to={'/instructor/assignments' as any}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('common.back')}
          </Link>
        </div>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {assignment.templateType}
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground mt-2">
              {assignment.title}
            </h1>
            {assignment.description && (
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
                {assignment.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative overflow-hidden rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('instructorAssignments.details.studentsProgress')}
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{totalStudents}</h3>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <Percent className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Average Progress
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{avgProgress}%</h3>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Completed Cohort
              </p>
              <h3 className="text-2xl font-bold text-foreground mt-1">
                {completedStudents} / {totalStudents}
              </h3>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('instructorAssignments.details.deadline')}
              </p>
              <h3 className="text-sm font-bold text-foreground mt-1.5">
                {format(new Date(assignment.finalDeadline), 'MMM d, yyyy')}
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* Details Meta Block */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
        <h3 className="text-base font-semibold text-foreground border-b pb-2">
          {t('instructorAssignments.details.overview')}
        </h3>
        <div className="grid gap-4 sm:grid-cols-3 text-sm">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              {t('instructorAssignments.details.template')}
            </span>
            <div className="flex items-center gap-2 font-medium text-foreground">
              <Clipboard className="h-4 w-4 text-primary/60" />
              {assignment.templateName}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              {t('instructorAssignments.details.type')}
            </span>
            <div className="font-medium text-foreground">{assignment.templateType}</div>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              {t('instructorAssignments.details.created')}
            </span>
            <div className="font-medium text-foreground">
              {format(new Date(assignment.createdAt), 'MMM d, yyyy HH:mm')}
            </div>
          </div>
        </div>
      </div>

      {/* Progress Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            {t('instructorAssignments.details.studentsProgress')}
          </h2>
        </div>
        <ProgressTable students={assignment.students} />
      </div>

      {/* Deadline Manager */}
      <DeadlineManager students={assignment.students} assignmentId={assignment.id} />
    </div>
  );
}
