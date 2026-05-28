import { useI18n } from '../../routes/__root';
import { Link } from '@tanstack/react-router';
import { ClipboardList, ClipboardCheck, FileText, ArrowRight, Users } from 'lucide-react';

interface PendingReviewItem {
  submissionId: number;
  checkpointName: string;
  assignmentTitle: string;
  studentName: string;
  submittedAt: string;
  waitTimeDays: number;
}

interface RecentSubmission {
  submissionId: number;
  studentName: string;
  assignmentTitle: string;
  checkpointName: string;
  submittedAt: string;
  status: string;
}

interface AssignmentOverview {
  id: number;
  title: string;
  finalDeadline: string | null;
  studentCount: number;
  pendingReviewCount: number;
  overallProgressPercent: number;
}

interface InstructorDashboardData {
  pendingReviewCount: number;
  pendingReviewItems: PendingReviewItem[];
  recentSubmissions: RecentSubmission[];
  assignments: AssignmentOverview[];
  error?: string;
}

interface Props {
  data: InstructorDashboardData;
}

function WidgetCard({
  title,
  children,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border bg-card p-4 shadow-sm ${className}`}>
      <h2 className="text-lg font-semibold text-foreground mb-3">{title}</h2>
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function SLABadge({ waitTimeDays }: { waitTimeDays: number }) {
  const { t } = useI18n();
  if (waitTimeDays < 2) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-400">
        {t('instructorReviews.slaOnTime')}
      </span>
    );
  }
  if (waitTimeDays < 3) {
    return (
      <span className="inline-flex items-center rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 text-[10px] font-medium text-yellow-700 dark:text-yellow-400">
        {t('instructorReviews.slaApproaching')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-400">
      {t('instructorReviews.slaBreached')}
    </span>
  );
}

export function InstructorDashboard({ data }: Props) {
  const { t } = useI18n();

  if (data?.error) {
    return (
      <div className="flex items-center justify-center py-12" aria-live="polite">
        <p className="text-destructive">{t('common.error')}</p>
      </div>
    );
  }

  const d = data as InstructorDashboardData;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Widget 1: Pending Review Queue */}
      <WidgetCard
        title={`${t('instructorDashboard.pendingReviews')} (${d.pendingReviewCount})`}
        className="md:col-span-2"
      >
        {d.pendingReviewItems.length === 0 ? (
          <EmptyState message={t('instructorDashboard.noPendingReviews')} />
        ) : (
          <div className="space-y-2">
            {d.pendingReviewItems.slice(0, 10).map((item) => (
              <Link
                key={item.submissionId}
                to={('/instructor/reviews/' + item.submissionId) as any}
                className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{item.studentName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.assignmentTitle} — {item.checkpointName}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <SLABadge waitTimeDays={item.waitTimeDays} />
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
            {d.pendingReviewItems.length > 10 && (
              <Link
                to={'/instructor/reviews' as any}
                className="block text-center text-sm text-primary hover:underline py-2"
              >
                {t('common.viewAll')}
              </Link>
            )}
          </div>
        )}
      </WidgetCard>

      {/* Widget 2: Recent Submissions */}
      <WidgetCard title={t('instructorDashboard.recentSubmissions')}>
        {d.recentSubmissions.length === 0 ? (
          <EmptyState message={t('instructorDashboard.noRecentSubmissions')} />
        ) : (
          <ul className="space-y-3">
            {d.recentSubmissions.map((sub) => (
              <li key={sub.submissionId} className="flex items-start gap-3">
                <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{sub.studentName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {sub.assignmentTitle} — {sub.checkpointName}
                  </p>
                </div>
                <span
                  className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    sub.status === 'Submitted'
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      : sub.status === 'Under Review'
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                        : sub.status === 'Pass'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                  }`}
                >
                  {sub.status === 'Submitted'
                    ? t('studentAssignments.status.submitted')
                    : sub.status === 'Under Review'
                      ? t('studentAssignments.status.under_review')
                      : sub.status === 'Pass'
                        ? t('studentAssignments.status.passed')
                        : t('studentAssignments.status.revise')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </WidgetCard>

      {/* Widget 3: Assignment Overview */}
      <WidgetCard title={t('instructorDashboard.assignmentOverview')}>
        {d.assignments.length === 0 ? (
          <EmptyState message={t('instructorDashboard.noAssignments')} />
        ) : (
          <div className="space-y-3">
            {d.assignments.slice(0, 5).map((assignment) => (
              <Link
                key={assignment.id}
                to={`/instructor/assignments/${assignment.id}` as any}
                className="block rounded-lg border p-3 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-medium text-foreground truncate">
                    {assignment.title}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {assignment.overallProgressPercent}%
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {assignment.studentCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <ClipboardCheck className="h-3 w-3" />
                    {t('instructorDashboard.pendingCount', {
                      count: String(assignment.pendingReviewCount),
                    })}
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all"
                    style={{ width: `${assignment.overallProgressPercent}%` }}
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </WidgetCard>

      {/* Widget 4: Quick Actions */}
      <WidgetCard title={t('instructorDashboard.quickActions')}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            to={'/instructor/reviews' as any}
            className="flex items-center gap-3 rounded-lg border p-4 hover:bg-accent/50 transition-colors"
          >
            <ClipboardCheck className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {t('instructorDashboard.goToReviewQueue')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('instructorDashboard.reviewQueueDesc')}
              </p>
            </div>
          </Link>
          <Link
            to={'/instructor/assignments' as any}
            className="flex items-center gap-3 rounded-lg border p-4 hover:bg-accent/50 transition-colors"
          >
            <ClipboardList className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {t('instructorDashboard.manageAssignments')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('instructorDashboard.manageAssignmentsDesc')}
              </p>
            </div>
          </Link>
        </div>
      </WidgetCard>
    </div>
  );
}
