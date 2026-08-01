import { useEffect, useState } from 'react';
import { listInterventions, getInterventionContext } from '@/server/interventions';
import { isServerError } from '@/lib/errors';
import { useI18n } from '@/routes/__root';
import { InterventionContextCard } from '@/components/instructor/interventions/InterventionContextCard';
import {
  InterventionList,
  type InterventionListItem,
} from '@/components/instructor/interventions/InterventionList';
import { InterventionListSkeleton } from '@/components/instructor/interventions/InterventionListSkeleton';

export interface AssignmentInterventionStudent {
  id: string;
  name: string;
  email?: string | null;
}

interface AssignmentInterventionsTabProps {
  assignmentId: number;
  students: AssignmentInterventionStudent[];
}

type LiveContext = NonNullable<
  Awaited<ReturnType<typeof getInterventionContext>> extends infer T
    ? T extends { context: infer C }
      ? C
      : never
    : never
>;

function hasStudentInactionRisk(context: LiveContext | undefined) {
  return (
    context?.assessment.factors.some((factor) => factor.category === 'student_inaction') ?? false
  );
}

export function AssignmentInterventionsTab({
  assignmentId,
  students,
}: AssignmentInterventionsTabProps) {
  const { t } = useI18n();
  const [interventions, setInterventions] = useState<InterventionListItem[]>([]);
  const [contexts, setContexts] = useState<Record<string, LiveContext>>({});
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setHasError(false);
      try {
        const [listResult, ...contextResults] = await Promise.all([
          listInterventions({ data: { assignmentId, page: 1, limit: 100 } }),
          ...students.map((student) =>
            getInterventionContext({ data: { assignmentId, studentId: student.id } }),
          ),
        ]);

        if (!active) return;
        if (isServerError(listResult) || !('interventions' in listResult)) {
          setHasError(true);
          return;
        }

        const nextContexts: Record<string, LiveContext> = {};
        contextResults.forEach((result, index) => {
          if (!isServerError(result) && 'context' in result) {
            nextContexts[students[index].id] = result.context;
          }
        });
        setInterventions(listResult.interventions as InterventionListItem[]);
        setContexts(nextContexts);
      } catch {
        if (active) setHasError(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [assignmentId, students]);

  if (loading) return <InterventionListSkeleton />;

  if (hasError) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
      >
        {t('instructorInterventions.loadError')}
      </p>
    );
  }

  return (
    <div className="space-y-5" data-testid="assignment-interventions-tab">
      {students.map((student) => {
        const studentInterventions = interventions.filter((item) => item.studentId === student.id);
        const activeInterventions = studentInterventions.filter(
          (item) => item.status === 'open' || item.status === 'monitoring',
        );
        const context = contexts[student.id];
        const hasActiveIntervention = activeInterventions.length > 0;
        const canCreate = hasStudentInactionRisk(context) && !hasActiveIntervention;
        const manageHref = `/instructor/interventions?assignmentId=${assignmentId}&studentId=${student.id}`;

        return (
          <article
            key={student.id}
            className="space-y-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-foreground">{student.name}</h3>
                {student.email && <p className="text-sm text-muted-foreground">{student.email}</p>}
              </div>
              {(canCreate || hasActiveIntervention) && (
                <a
                  href={manageHref}
                  data-testid={`${hasActiveIntervention ? 'manage' : 'create'}-intervention-${student.id}`}
                  className="inline-flex min-h-11 items-center rounded-md border border-primary px-4 text-sm font-medium text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {hasActiveIntervention
                    ? t('instructorInterventions.manage')
                    : t('instructorInterventions.create')}
                </a>
              )}
            </div>

            {context && context.assessment.factors.length > 0 && (
              <InterventionContextCard context={context} />
            )}

            {studentInterventions.length > 0 ? (
              <InterventionList
                interventions={studentInterventions}
                manageHref={(intervention) =>
                  intervention.status === 'open' || intervention.status === 'monitoring'
                    ? manageHref
                    : undefined
                }
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('instructorInterventions.emptyDescription')}
              </p>
            )}

            {studentInterventions.length > 0 && (
              <nav
                className="flex flex-wrap gap-2 text-sm"
                aria-label={t('instructorInterventions.action')}
              >
                <a
                  href={`/instructor/assignments/${assignmentId}#consultations`}
                  className="min-h-11 rounded-md px-3 py-2 text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t('instructorInterventions.actions.consultation')}
                </a>
                <a
                  href={`/instructor/assignments/${assignmentId}#extensions`}
                  className="min-h-11 rounded-md px-3 py-2 text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t('instructorInterventions.actions.extension')}
                </a>
                <a
                  href={`/instructor/assignments/${assignmentId}#discussions`}
                  className="min-h-11 rounded-md px-3 py-2 text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t('instructorInterventions.actions.discussion')}
                </a>
              </nav>
            )}
          </article>
        );
      })}
    </div>
  );
}
