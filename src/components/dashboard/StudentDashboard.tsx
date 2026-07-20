import { useI18n } from '../../routes/__root';
import { Link } from '@tanstack/react-router';
import { Clock, FileText, MessageSquare, ClipboardList, Calendar } from 'lucide-react';
import { formatDateShort } from '@/lib/format';
import { formatDate } from '@/lib/format-date';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';

interface ActiveAssignment {
  id: number;
  title: string;
  finalDeadline: string | null;
  effectiveDeadline?: Date | string | null;
  templateName: string;
  templateType: string;
  progressPercent: number;
  currentState: string;
}

interface UpcomingDeadline {
  assignmentId: number;
  assignmentTitle: string;
  checkpointName: string;
  dueDate: string | null;
  state: string;
  isOverdue: boolean;
  daysRemaining: number | null;
}

interface PendingReview {
  submissionId: number;
  assignmentTitle: string;
  checkpointName: string;
  submittedAt: string;
  waitTimeDays: number;
}

interface ConsultationReminder {
  consultationId: number;
  assignmentTitle: string;
  checkpointName: string;
  consultationDate: string;
}

export interface StudentDashboardData {
  activeAssignments: ActiveAssignment[];
  upcomingDeadlines: UpcomingDeadline[];
  pendingReviews: PendingReview[];
  consultationReminders: ConsultationReminder[];
  error?: string;
}

interface Props {
  data: StudentDashboardData;
}

export function StudentDashboard({ data }: Props) {
  const { t, locale } = useI18n();

  if (data?.error) {
    return (
      <div className="flex items-center justify-center py-12" aria-live="polite">
        <p className="text-destructive">{t('common.error')}</p>
      </div>
    );
  }

  const d = data as StudentDashboardData;

  return (
    <div className="grid gap-6 md:grid-cols-2">
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
                  <h3 className="font-medium text-foreground truncate mb-2">{assignment.title}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {(() => {
                        const deadline = assignment.effectiveDeadline ?? assignment.finalDeadline;
                        return t('studentDashboard.deadline', {
                          date: deadline ? formatDateShort(deadline, locale) : '—',
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
              {d.upcomingDeadlines.map((deadline, idx) => (
                <li key={idx} className="flex items-start gap-3">
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
                        : formatDate(deadline.dueDate, locale, 'short')}
                      {deadline.isOverdue && (
                        <Badge variant="destructive" className="ml-1">
                          {t('studentDashboard.overdue')}
                        </Badge>
                      )}
                    </p>
                  </div>
                </li>
              ))}
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
              {d.pendingReviews.map((review) => (
                <li key={review.submissionId} className="flex items-start gap-3">
                  <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {review.checkpointName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {review.assignmentTitle}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('studentDashboard.submittedAgo', { days: String(review.waitTimeDays) })}
                    </p>
                  </div>
                  <Badge variant="warning">{t('studentDashboard.underReview')}</Badge>
                </li>
              ))}
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
              {d.consultationReminders.map((reminder) => (
                <li key={reminder.consultationId} className="flex items-start gap-3">
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
                        ? formatDate(reminder.consultationDate, locale, 'short')
                        : ''}
                    </p>
                  </div>
                  <Badge variant="warning">{t('studentDashboard.pending')}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
