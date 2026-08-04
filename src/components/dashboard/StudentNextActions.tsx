import { Link } from '@tanstack/react-router';
import { ArrowRight, ClipboardList, Clock, FileText, MessageSquare } from 'lucide-react';
import { useI18n } from '../../routes/__root';
import { formatDate } from '@/lib/format-date';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import type {
  StudentActionKind,
  StudentActionPriority,
  StudentNextAction,
  StudentNextActionsResult,
} from '@/lib/student-next-actions';

interface Props {
  data: StudentNextActionsResult;
}

type WaitingGroup = {
  key: 'submitted' | 'underReview';
  label:
    | 'studentDashboard.nextActions.waiting.submitted'
    | 'studentDashboard.nextActions.waiting.underReview';
  group: StudentNextActionsResult['waitingSummary']['submitted'];
  variant: 'info' | 'warning';
};

const actionLabels = {
  submit: 'studentDashboard.nextActions.actions.submit',
  revise: 'studentDashboard.nextActions.actions.revise',
  consultation: 'studentDashboard.nextActions.actions.consultation',
} as const;

function getActionIcon(kind: StudentActionKind) {
  if (kind === 'consultation') return MessageSquare;
  if (kind === 'revise') return FileText;
  return ClipboardList;
}

function getActionBadgeVariant(priority: StudentActionPriority) {
  if (priority === 'overdue') return 'destructive' as const;
  if (priority === 'revise' || priority === 'consultation') return 'warning' as const;
  return 'info' as const;
}

function ActionCard({ action }: { action: StudentNextAction }) {
  const { t, locale } = useI18n();
  const ActionIcon = getActionIcon(action.kind);
  const priorityLabel =
    action.priority === 'overdue'
      ? t('studentDashboard.nextActions.priority.overdue')
      : action.priority === 'revise'
        ? t('studentDashboard.nextActions.priority.revise')
        : action.priority === 'consultation'
          ? t('studentDashboard.nextActions.priority.consultation')
          : action.priority === 'within_168_hours'
            ? t('studentDashboard.nextActions.priority.within_168_hours')
            : action.priority === 'dated'
              ? t('studentDashboard.nextActions.priority.dated')
              : t('studentDashboard.nextActions.priority.undated');
  const accessibleLabel =
    action.kind === 'consultation'
      ? t('studentDashboard.nextActions.requiredConsultation', {
          assignment: action.assignmentTitle,
          checkpoint: action.checkpointName,
        })
      : action.kind === 'revise'
        ? t('studentDashboard.nextActions.reviseCheckpoint', {
            assignment: action.assignmentTitle,
            checkpoint: action.checkpointName,
          })
        : t('studentDashboard.nextActions.submitCheckpoint', {
            assignment: action.assignmentTitle,
            checkpoint: action.checkpointName,
          });

  return (
    <Link
      to={action.href as never}
      aria-label={accessibleLabel}
      className="group flex min-w-0 items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <ActionIcon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            {t(actionLabels[action.kind])}
          </span>
          <Badge variant={getActionBadgeVariant(action.priority)}>{priorityLabel}</Badge>
        </span>
        <span className="mt-1 block truncate text-sm text-foreground">{action.checkpointName}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {action.assignmentTitle}
        </span>
        <span className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3.5" aria-hidden="true" />
          {action.dueDate
            ? t('studentDashboard.nextActions.due', {
                date: formatDate(action.dueDate, locale, 'short'),
              })
            : t('studentDashboard.nextActions.noDueDate')}
        </span>
        {action.revisionActionPlan && (
          <span className="mt-3 block rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {t('studentDashboard.nextActions.revisionPlan.remaining', {
                count: String(action.revisionActionPlan.unresolvedCount),
              })}
            </span>
            <ul
              aria-label={t('studentDashboard.nextActions.revisionPlan.itemsLabel')}
              className="mt-1 list-inside list-disc space-y-0.5"
            >
              {action.revisionActionPlan.items.map((item, index) => (
                <li key={`${item}-${index}`} className="truncate">
                  {item}
                </li>
              ))}
            </ul>
          </span>
        )}
      </span>
      <ArrowRight
        className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}

export function StudentNextActions({ data }: Props) {
  const { t } = useI18n();
  const visiblePrimaryActions = data.primaryActions.slice(0, 5);
  const waitingGroups: WaitingGroup[] = [
    {
      key: 'submitted' as const,
      label: 'studentDashboard.nextActions.waiting.submitted' as const,
      group: data.waitingSummary.submitted,
      variant: 'info' as const,
    },
    {
      key: 'underReview' as const,
      label: 'studentDashboard.nextActions.waiting.underReview' as const,
      group: data.waitingSummary.underReview,
      variant: 'warning' as const,
    },
  ].filter(({ group }) => group.count > 0);
  const visibleWaitingGroups = waitingGroups.map((waitingGroup, index) => {
    const reservedForOtherGroups = waitingGroups
      .slice(index + 1)
      .filter(({ group }) => group.representatives.length > 0).length;
    const available = Math.max(1, 3 - reservedForOtherGroups);
    return {
      ...waitingGroup,
      group: {
        ...waitingGroup.group,
        representatives: waitingGroup.group.representatives.slice(0, available),
      },
    };
  });

  let visibleRepresentativeCount = 0;
  const cappedWaitingGroups = visibleWaitingGroups.map((waitingGroup) => {
    const remaining = Math.max(0, 3 - visibleRepresentativeCount);
    const representatives = waitingGroup.group.representatives.slice(0, remaining);
    visibleRepresentativeCount += representatives.length;
    return { ...waitingGroup, group: { ...waitingGroup.group, representatives } };
  });

  return (
    <Card className="md:col-span-2 border-primary/20 bg-primary/[0.02]">
      <CardHeader>
        <h2 className="flex items-center gap-2 font-sans text-base leading-snug font-medium">
          <ClipboardList className="size-5 text-primary" aria-hidden="true" />
          {t('studentDashboard.nextActions.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('studentDashboard.nextActions.description')}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {visiblePrimaryActions.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={t('studentDashboard.nextActions.empty')}
            description={t('studentDashboard.nextActions.emptyDescription')}
            compact
          />
        ) : (
          <div
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            aria-label={t('studentDashboard.nextActions.title')}
          >
            {visiblePrimaryActions.map((action) => (
              <ActionCard key={`${action.assignmentId}-${action.checkpointId}`} action={action} />
            ))}
          </div>
        )}

        {waitingGroups.length > 0 && (
          <section aria-labelledby="student-dashboard-waiting-title" className="space-y-3">
            <div>
              <h3
                id="student-dashboard-waiting-title"
                className="text-sm font-semibold text-foreground"
              >
                {t('studentDashboard.nextActions.waiting.title')}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t('studentDashboard.nextActions.waiting.description')}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {cappedWaitingGroups.map(({ key, label, group, variant }) => (
                <div key={key} className="min-w-0 rounded-lg border bg-card/70 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <Badge variant={variant}>{t(label)}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {t('studentDashboard.nextActions.waiting.count', {
                        count: String(group.count),
                      })}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {group.representatives.map((representative) => (
                      <li key={`${representative.assignmentId}-${representative.checkpointId}`}>
                        <Link
                          to={representative.href as never}
                          aria-label={t('studentDashboard.nextActions.openWaitingCheckpoint', {
                            assignment: representative.assignmentTitle,
                            checkpoint: representative.checkpointName,
                          })}
                          className="inline-flex max-w-full items-center gap-1 text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <span className="truncate">{representative.checkpointName}</span>
                          <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
