import { useI18n } from '../../routes/__root';
import { Link } from '@tanstack/react-router';
import { Clock, FileText, MessageSquare, ClipboardList, Calendar } from 'lucide-react';
import { formatRelativeTime } from '@/lib/format';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import { useStudentDateFormatter } from '@/hooks/use-student-date';
import { StudentNextActions } from '@/components/dashboard/StudentNextActions';
import type { StudentNextActionsResult } from '@/lib/student-next-actions';

interface ActiveAssignment {
  id: number;
  title: string;
  finalDeadline: Date;
  effectiveDeadline?: Date | null;
  templateName: string;
  templateType: string;
  progressPercent: number;
  currentState: string;
}

interface UpcomingDeadline {
  assignmentId: number;
  checkpointId?: number;
  assignmentTitle: string;
  checkpointName: string;
  dueDate: string | null;
  state: string;
  isOverdue: boolean;
  daysRemaining: number | null;
}

interface PendingReview {
  submissionId: number;
  assignmentId?: number;
  checkpointId?: number;
  assignmentTitle: string;
  checkpointName: string;
  submittedAt: Date | null;
  waitTimeDays: number;
}

interface ConsultationReminder {
  consultationId: number;
  assignmentId?: number;
  checkpointId?: number;
  assignmentTitle: string;
  checkpointName: string;
  consultationDate: Date | null;
}

export interface StudentDashboardData {
  activeAssignments: ActiveAssignment[];
  upcomingDeadlines: UpcomingDeadline[];
  pendingReviews: PendingReview[];
  consultationReminders: ConsultationReminder[];
  nextActions?: StudentNextActionsResult;
  error?: string;
}

const emptyNextActions: StudentNextActionsResult = {
  primaryActions: [],
  waitingSummary: {
    submitted: { count: 0, representatives: [] },
    underReview: { count: 0, representatives: [] },
  },
};

interface Props {
  data: StudentDashboardData;
}

export function StudentDashboard({ data }: Props) {
  const { t, locale } = useI18n();
  const { format, formatShort, hydrated } = useStudentDateFormatter(locale);

  if (data?.error) {
    return (
      <div className="flex items-center justify-center py-12" aria-live="polite">
        <p className="text-destructive">{data.error}</p>
      </div>
    );
  }

  const d = data as StudentDashboardData;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <StudentNextActions data={d.nextActions ?? emptyNextActions} />

      {/* Widget 1: Active Assignments Overview */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>{t('studentDashboard.activeAssignments')}</CardTitle>
        </CardHeader>
        <CardContent>
          {d.activeAssignments.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={t('studentDashboard.noActiveAssignments')}
              description=""
              compact
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {d.activeAssignments.map((assignment) => (
                <Link
                  key={assignment.id}
                  to={`/student/assignments/${assignment.id}` as never}
                  className="block rounded-lg border bg-card p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline">{assignment.templateType}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {assignment.progressPercent ?? 0}%
                    </span>
                  </div>
                  <h2 className="font-medium text-foreground truncate mb-2">{assignment.title}</h2>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {(() => {
                        const deadline = assignment.effectiveDeadline ?? assignment.finalDeadline;
                        return t('studentDashboard.deadline', {
                          date: deadline && hydrated ? formatShort(deadline) : '—',
                        });
                      })()}
                    </span>
                  </div>
                  <Progress value={assignment.progressPercent ?? 0} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Widget 2: Upcoming Deadlines */}
      <Card>
        <CardHeader>
          <CardTitle>{t('studentDashboard.upcomingDeadlines')}</CardTitle>
        </CardHeader>
        <CardContent>
          {d.upcomingDeadlines.length === 0 ? (
            <EmptyState
              icon={Clock}
              title={t('studentDashboard.noUpcomingDeadlines')}
              description=""
              compact
            />
          ) : (
            <ul className="space-y-3">
              {d.upcomingDeadlines.map((deadline) => {
                const href = deadline.checkpointId
                  ? `/student/assignments/${deadline.assignmentId}/checkpoints/${deadline.checkpointId}`
                  : `/student/assignments/${deadline.assignmentId}`;

                return (
                  <li
                    key={`${deadline.assignmentId}-${deadline.checkpointId ?? deadline.checkpointName}`}
                  >
                    <Link
                      to={href as never}
                      className="flex min-h-11 items-start gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <Clock
                        className={`h-4 w-4 mt-0.5 shrink-0 ${
                          deadline.isOverdue ? 'text-destructive' : 'text-muted-foreground'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {deadline.checkpointName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {deadline.assignmentTitle}
                        </p>
                        <p
                          className={`text-xs mt-0.5 ${
                            deadline.isOverdue
                              ? 'text-destructive font-medium'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {deadline.dueDate === null
                            ? t('studentDashboard.noDeadline')
                            : `${format(deadline.dueDate, 'short') || '—'} (${formatRelativeTime(deadline.dueDate, locale)})`}
                          {deadline.isOverdue && (
                            <Badge variant="destructive" className="ml-1">
                              {t('studentDashboard.overdue')}
                            </Badge>
                          )}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Widget 3: Pending Reviews */}
      <Card>
        <CardHeader>
          <CardTitle>{t('studentDashboard.pendingReviews')}</CardTitle>
        </CardHeader>
        <CardContent>
          {d.pendingReviews.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={t('studentDashboard.noPendingReviews')}
              description=""
              compact
            />
          ) : (
            <ul className="space-y-3">
              {d.pendingReviews.map((review) => {
                const href =
                  review.assignmentId && review.checkpointId
                    ? `/student/assignments/${review.assignmentId}/checkpoints/${review.checkpointId}`
                    : '/student/assignments';

                return (
                  <li key={review.submissionId}>
                    <Link
                      to={href as never}
                      className="flex min-h-11 items-start gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {review.checkpointName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {review.assignmentTitle}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t('studentDashboard.submittedAgo', {
                            days: String(review.waitTimeDays),
                          })}
                        </p>
                      </div>
                      <Badge variant="warning">{t('studentDashboard.underReview')}</Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Widget 4: Consultation Reminders */}
      <Card>
        <CardHeader>
          <CardTitle>{t('studentDashboard.consultationReminders')}</CardTitle>
        </CardHeader>
        <CardContent>
          {d.consultationReminders.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title={t('studentDashboard.noConsultationReminders')}
              description=""
              compact
            />
          ) : (
            <ul className="space-y-3">
              {d.consultationReminders.map((reminder) => {
                const href =
                  reminder.assignmentId && reminder.checkpointId
                    ? `/student/assignments/${reminder.assignmentId}/checkpoints/${reminder.checkpointId}`
                    : '/student/assignments';

                return (
                  <li key={reminder.consultationId}>
                    <Link
                      to={href as never}
                      className="flex min-h-11 items-start gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <MessageSquare className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {reminder.checkpointName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {reminder.assignmentTitle}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {reminder.consultationDate
                            ? format(reminder.consultationDate, 'short')
                            : ''}
                        </p>
                      </div>
                      <Badge variant="warning">{t('studentDashboard.pending')}</Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
