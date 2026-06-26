import { useI18n } from '../../routes/__root';
import type { TranslationKey } from '../../i18n/index';
import { Link } from '@tanstack/react-router';
import { ClipboardList, ClipboardCheck, FileText, ArrowRight, Users, BookOpen } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { MetricCard } from '@/components/ui/metric-card';
import { SLABadge } from '@/components/reviews/SLABadge';

interface PendingReviewItem {
  submissionId: number;
  checkpointName: string;
  assignmentTitle: string;
  studentName: string;
  submittedAt: string | null;
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

export interface InstructorDashboardData {
  pendingReviewCount: number;
  pendingReviewItems: PendingReviewItem[];
  recentSubmissions: RecentSubmission[];
  assignments: AssignmentOverview[];
  error?: string;
}

interface Props {
  data: InstructorDashboardData;
}

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case 'Submitted':
      return 'info' as const;
    case 'Under Review':
      return 'warning' as const;
    case 'Pass':
      return 'success' as const;
    default:
      return 'warning' as const;
  }
}

function getStatusBadgeText(status: string, t: (key: TranslationKey) => string) {
  switch (status) {
    case 'Submitted':
      return t('studentAssignments.status.submitted');
    case 'Under Review':
      return t('studentAssignments.status.under_review');
    case 'Pass':
      return t('studentAssignments.status.passed');
    default:
      return t('studentAssignments.status.revise');
  }
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
  const totalStudents = d.assignments.reduce((sum, a) => sum + a.studentCount, 0);

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label={t('instructorDashboard.pendingReviews')}
          value={d.pendingReviewCount}
          icon={ClipboardCheck}
          color="warning"
        />
        <MetricCard
          label={t('instructorDashboard.activeAssignments')}
          value={d.assignments.length}
          icon={BookOpen}
          color="primary"
        />
        <MetricCard
          label={t('instructorDashboard.totalStudents')}
          value={totalStudents}
          icon={Users}
          color="info"
        />
      </div>

      {/* Pending Review Queue */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t('instructorDashboard.pendingReviews')} ({d.pendingReviewCount})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {d.pendingReviewItems.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title={t('instructorDashboard.noPendingReviews')}
              description=""
            />
          ) : (
            <div className="space-y-2">
              {d.pendingReviewItems.slice(0, 10).map((item) => (
                <Link
                  key={item.submissionId}
                  to={('/instructor/reviews/' + item.submissionId) as never}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {item.studentName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.assignmentTitle} — {item.checkpointName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {item.submittedAt && (
                      <SLABadge state="under_review" updatedAt={new Date(item.submittedAt)} />
                    )}
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
              {d.pendingReviewItems.length > 10 && (
                <Link
                  to={'/instructor/reviews' as never}
                  className="block text-center text-sm text-primary hover:underline py-2"
                >
                  {t('common.viewAll')}
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Submissions */}
        <Card>
          <CardHeader>
            <CardTitle>{t('instructorDashboard.recentSubmissions')}</CardTitle>
          </CardHeader>
          <CardContent>
            {d.recentSubmissions.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={t('instructorDashboard.noRecentSubmissions')}
                description=""
              />
            ) : (
              <ul className="space-y-3">
                {d.recentSubmissions.map((sub) => (
                  <li key={sub.submissionId} className="flex items-start gap-3">
                    <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {sub.studentName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {sub.assignmentTitle} — {sub.checkpointName}
                      </p>
                    </div>
                    <Badge variant={getStatusBadgeVariant(sub.status)}>
                      {getStatusBadgeText(sub.status, t)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Assignment Overview */}
        <Card>
          <CardHeader>
            <CardTitle>{t('instructorDashboard.assignmentOverview')}</CardTitle>
          </CardHeader>
          <CardContent>
            {d.assignments.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title={t('instructorDashboard.noAssignments')}
                description=""
              />
            ) : (
              <div className="space-y-3">
                {d.assignments.slice(0, 5).map((assignment) => (
                  <Link
                    key={assignment.id}
                    to={`/instructor/assignments/${assignment.id}` as never}
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
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('instructorDashboard.quickActions')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              to={'/instructor/reviews' as never}
              className="flex items-center gap-3 rounded-lg border p-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
            >
              <div className="flex size-11 items-center justify-center rounded-md bg-primary/10">
                <ClipboardCheck className="h-5 w-5 text-primary" />
              </div>
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
              to={'/instructor/assignments' as never}
              className="flex items-center gap-3 rounded-lg border p-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
            >
              <div className="flex size-11 items-center justify-center rounded-md bg-success/10">
                <ClipboardList className="h-5 w-5 text-success" />
              </div>
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
        </CardContent>
      </Card>
    </div>
  );
}
