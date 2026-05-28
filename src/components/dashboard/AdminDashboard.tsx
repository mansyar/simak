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
} from 'lucide-react';

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

interface EscalationAlert {
  submissionId: number;
  instructorName: string;
  assignmentTitle: string;
  checkpointName: string;
  studentName: string;
  daysOverdue: number;
}

interface AdminDashboardData {
  metrics: SystemMetrics;
  recentActivity: ActivityEvent[];
  escalationAlerts: EscalationAlert[];
  error?: string;
}

interface Props {
  data: AdminDashboardData;
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

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-primary/10 p-2">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
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
      {/* Widget 1: System Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label={t('adminDashboard.totalUsers')}
          value={d.metrics?.totalUsers ?? 0}
          icon={Users}
        />
        <MetricCard
          label={t('adminDashboard.instructors')}
          value={d.metrics?.instructors ?? 0}
          icon={Users}
        />
        <MetricCard
          label={t('adminDashboard.students')}
          value={d.metrics?.students ?? 0}
          icon={Users}
        />
        <MetricCard
          label={t('adminDashboard.activeAssignments')}
          value={d.metrics?.activeAssignments ?? 0}
          icon={ClipboardList}
        />
        <MetricCard
          label={t('adminDashboard.pendingReviews')}
          value={d.metrics?.pendingReviews ?? 0}
          icon={ClipboardCheck}
        />
        <MetricCard
          label={t('adminDashboard.activeConsultations')}
          value={d.metrics?.activeConsultations ?? 0}
          icon={MessageSquare}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Widget 2: Recent Activity Feed */}
        <WidgetCard title={t('adminDashboard.recentActivity')}>
          {d.recentActivity.length === 0 ? (
            <EmptyState message={t('adminDashboard.noRecentActivity')} />
          ) : (
            <ul className="space-y-3">
              {d.recentActivity.map((event) => (
                <li key={event.id} className="flex items-start gap-3">
                  <Bell className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
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
        </WidgetCard>

        {/* Widget 3: Deadline Escalation Alerts */}
        <WidgetCard title={t('adminDashboard.escalationAlerts')}>
          {d.escalationAlerts.length === 0 ? (
            <EmptyState message={t('adminDashboard.noEscalationAlerts')} />
          ) : (
            <ul className="space-y-3">
              {d.escalationAlerts.map((alert) => (
                <li
                  key={alert.submissionId}
                  className={`flex items-start gap-3 rounded-lg border p-3 ${alert.daysOverdue > 3 ? 'bg-destructive/5 border-destructive/20' : ''}`}
                >
                  <AlertTriangle
                    className={`h-4 w-4 mt-0.5 shrink-0 ${alert.daysOverdue > 3 ? 'text-destructive' : 'text-muted-foreground'}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {alert.instructorName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {alert.assignmentTitle} — {alert.checkpointName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t('adminDashboard.student')}: {alert.studentName}
                    </p>
                    <p
                      className={`text-xs mt-0.5 ${alert.daysOverdue > 3 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}
                    >
                      {alert.daysOverdue} {t('adminDashboard.daysOverdue')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </WidgetCard>
      </div>

      {/* Widget 4: Quick Actions */}
      <WidgetCard title={t('adminDashboard.quickActions')}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            to={'/admin/users' as any}
            className="flex items-center gap-3 rounded-lg border p-4 hover:bg-accent/50 transition-colors"
          >
            <UserPlus className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {t('adminDashboard.manageUsers')}
              </p>
              <p className="text-xs text-muted-foreground">{t('adminDashboard.manageUsersDesc')}</p>
            </div>
          </Link>
          <Link
            to={'/admin/templates' as any}
            className="flex items-center gap-3 rounded-lg border p-4 hover:bg-accent/50 transition-colors"
          >
            <FileType className="h-5 w-5 text-primary" />
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
      </WidgetCard>
    </div>
  );
}
