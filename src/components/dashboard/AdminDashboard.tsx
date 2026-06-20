import { useI18n } from '../../routes/__root';
import { formatDate } from '@/lib/format-date';
import {
  Users,
  ClipboardList,
  ClipboardCheck,
  MessageSquare,
  Bell,
  AlertTriangle,
  AlertCircle,
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
import { QuickActionCard } from '@/components/ui/quick-action-card';
import { EmailQueueStat } from '@/components/ui/email-queue-stat';
import { getActionVisualProps } from '@/lib/admin/audit-actions';

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

export function AdminDashboard({ data }: Props) {
  const { t, locale } = useI18n();

  if (data?.error) {
    return (
      <div aria-live="polite">
        <EmptyState icon={AlertCircle} title={t('common.error')} />
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
            <CardTitle>{t('adminDashboard.emailQueue.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <EmailQueueStat
                icon={Mail}
                color="primary"
                label={t('adminDashboard.emailQueue.pending')}
                value={d.emailQueueCounts?.pending ?? 0}
              />
              <EmailQueueStat
                icon={MailCheck}
                color="success"
                label={t('adminDashboard.emailQueue.sent')}
                value={d.emailQueueCounts?.sent ?? 0}
              />
              <EmailQueueStat
                icon={MailX}
                color="error"
                label={t('adminDashboard.emailQueue.failed')}
                value={d.emailQueueCounts?.failed ?? 0}
              />
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
                description={t('adminDashboard.allOnTrack')}
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
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-error text-foreground">
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
                    <StatusDot
                      variant={getActionVisualProps(event.type).dotVariant}
                      className="mt-[6px]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">{event.title}</p>
                      {event.message && (
                        <p className="text-xs text-muted-foreground truncate">{event.message}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDate(event.createdAt, locale, 'short')}
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
              <QuickActionCard
                to="/admin/users"
                label={t('adminDashboard.manageUsers')}
                description={t('adminDashboard.manageUsersDesc')}
                icon={UserPlus}
                color="primary"
              />
              <QuickActionCard
                to="/admin/templates"
                label={t('adminDashboard.manageTemplates')}
                description={t('adminDashboard.manageTemplatesDesc')}
                icon={FileType}
                color="success"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
