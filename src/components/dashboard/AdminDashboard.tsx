import { useI18n } from '../../routes/__root';
import { Link } from '@tanstack/react-router';
import {
  Users,
  ClipboardList,
  ClipboardCheck,
  MessageSquare,
  Bell,
  AlertTriangle,
  UserPlus,
  FileType,
  Mail,
  MailCheck,
  MailX,
  Clock,
} from 'lucide-react';
import { MetricCard } from '@/components/ui/metric-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusDot } from '@/components/ui/status-dot';

interface SystemMetrics {
  totalUsers: number;
  instructors: number;
  students: number;
  activeAssignments: number;
  pendingReviews: number;
  activeConsultations: number;
}

interface ActivityEvent {
  id: number;
  type: string;
  title: string;
  message: string | null;
  createdAt: string;
}

interface EmailQueueCounts {
  pending: number;
  sent: number;
  failed: number;
}

interface EscalationAlert {
  submissionId: number;
  instructorName: string;
  assignmentTitle: string;
  checkpointName: string;
  studentName: string;
  daysOverdue: number;
}

export interface AdminDashboardData {
  metrics: SystemMetrics;
  emailQueueCounts: EmailQueueCounts;
  recentActivity: ActivityEvent[];
  escalationAlerts: EscalationAlert[];
  error?: string;
}

interface Props {
  data: AdminDashboardData;
}

function getActivityDotColor(_type: string) {
  return 'verified' as const;
}

export function AdminDashboard({ data }: Props) {
  const { t } = useI18n();

  if (data?.error) {
    return (
      <div className="flex items-center justify-center py-12" aria-live="polite">
        <p className="text-destructive">{t('common.error')}</p>
      </div>
    );
  }

  const d = data as AdminDashboardData;

  return (
    <div className="space-y-6">
      {/* System Metrics */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label={t('adminDashboard.totalUsers')}
          value={d.metrics?.totalUsers ?? 0}
          icon={Users}
          color="primary"
        />
        <MetricCard
          label={t('adminDashboard.instructors')}
          value={d.metrics?.instructors ?? 0}
          icon={Users}
          color="warning"
        />
        <MetricCard
          label={t('adminDashboard.students')}
          value={d.metrics?.students ?? 0}
          icon={Users}
          color="success"
        />
        <MetricCard
          label={t('adminDashboard.activeAssignments')}
          value={d.metrics?.activeAssignments ?? 0}
          icon={ClipboardList}
          color="info"
        />
        <MetricCard
          label={t('adminDashboard.pendingReviews')}
          value={d.metrics?.pendingReviews ?? 0}
          icon={ClipboardCheck}
          color="primary"
        />
        <MetricCard
          label={t('adminDashboard.activeConsultations')}
          value={d.metrics?.activeConsultations ?? 0}
          icon={MessageSquare}
          color="success"
        />
      </div>

      {/* Email Queue & Escalation Alerts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Email Queue */}
        <Card>
          <CardHeader>
            <CardTitle>Email Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-card p-5 text-center">
                <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Mail className="size-5" />
                </div>
                <div className="font-display text-[1.75rem] font-bold leading-none text-foreground">
                  {d.emailQueueCounts?.pending ?? 0}
                </div>
                <p className="mt-1 text-[0.8125rem] font-medium text-primary">
                  {t('adminDashboard.emailQueue.pending')}
                </p>
              </div>
              <div className="rounded-lg bg-card p-5 text-center">
                <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-success/10 text-success">
                  <MailCheck className="size-5" />
                </div>
                <div className="font-display text-[1.75rem] font-bold leading-none text-foreground">
                  {d.emailQueueCounts?.sent ?? 0}
                </div>
                <p className="mt-1 text-[0.8125rem] font-medium text-success">
                  {t('adminDashboard.emailQueue.sent')}
                </p>
              </div>
              <div className="rounded-lg bg-card p-5 text-center">
                <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-error/10 text-error">
                  <MailX className="size-5" />
                </div>
                <div className="font-display text-[1.75rem] font-bold leading-none text-foreground">
                  {d.emailQueueCounts?.failed ?? 0}
                </div>
                <p className="mt-1 text-[0.8125rem] font-medium text-error">
                  {t('adminDashboard.emailQueue.failed')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Escalation Alerts */}
        <Card>
          <CardHeader>
            <CardTitle>{t('adminDashboard.escalationAlerts')}</CardTitle>
          </CardHeader>
          <CardContent>
            {d.escalationAlerts.length === 0 ? (
              <EmptyState
                icon={Clock}
                title={t('adminDashboard.noEscalationAlerts')}
                description="All assignments are on track"
              />
            ) : (
              <ul className="space-y-3">
                {d.escalationAlerts.map((alert) => (
                  <li
                    key={alert.submissionId}
                    className={`flex items-start gap-4 rounded-lg p-4 ${
                      alert.daysOverdue > 3
                        ? 'bg-error/5 border border-error/20'
                        : 'bg-muted/30 border border-border'
                    }`}
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-error text-white">
                      <AlertTriangle className="size-[18px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {alert.instructorName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {alert.assignmentTitle} — {alert.checkpointName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {t('adminDashboard.student')}: {alert.studentName}
                      </p>
                      <p
                        className={`text-xs mt-0.5 ${
                          alert.daysOverdue > 3 ? 'text-error font-medium' : 'text-muted-foreground'
                        }`}
                      >
                        {alert.daysOverdue} {t('adminDashboard.daysOverdue')}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>{t('adminDashboard.recentActivity')}</CardTitle>
          </CardHeader>
          <CardContent>
            {d.recentActivity.length === 0 ? (
              <EmptyState
                icon={Bell}
                title={t('adminDashboard.noRecentActivity')}
                description="No recent activity to display"
              />
            ) : (
              <ul className="space-y-3">
                {d.recentActivity.map((event) => (
                  <li
                    key={event.id}
                    className="flex items-start gap-3 border-b border-border/50 pb-3 last:border-b-0 last:pb-0"
                  >
                    <StatusDot variant={getActivityDotColor(event.type)} className="mt-[6px]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">{event.title}</p>
                      {event.message && (
                        <p className="text-xs text-muted-foreground truncate">{event.message}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {event.createdAt ? new Date(event.createdAt).toLocaleDateString() : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>{t('adminDashboard.quickActions')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <Link
                to={'/admin/users' as never}
                className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
              >
                <div className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <UserPlus className="size-[18px]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t('adminDashboard.manageUsers')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('adminDashboard.manageUsersDesc')}
                  </p>
                </div>
              </Link>
              <Link
                to={'/admin/templates' as never}
                className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
              >
                <div className="flex size-9 items-center justify-center rounded-md bg-success/10 text-success">
                  <FileType className="size-[18px]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t('adminDashboard.manageTemplates')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('adminDashboard.manageTemplatesDesc')}
                  </p>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
