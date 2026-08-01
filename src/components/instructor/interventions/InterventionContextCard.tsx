import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/routes/__root';
import type { LiveStudentRiskContext } from '@/server/student-risk-context.server';

interface InterventionContextCardProps {
  context: LiveStudentRiskContext;
}

export function InterventionContextCard({ context }: InterventionContextCardProps) {
  const { t } = useI18n();
  const riskLabels = {
    high: t('instructorInterventions.risk.high'),
    medium: t('instructorInterventions.risk.medium'),
    low: t('instructorInterventions.risk.low'),
  };
  const factorLabels = {
    overdue_checkpoint: t('instructorInterventions.factors.overdue_checkpoint'),
    approaching_deadline_no_submission: t(
      'instructorInterventions.factors.approaching_deadline_no_submission',
    ),
    insufficient_consultations: t('instructorInterventions.factors.insufficient_consultations'),
    repeated_revise: t('instructorInterventions.factors.repeated_revise'),
    stalled_review: t('instructorInterventions.factors.stalled_review'),
  };

  return (
    <Card className="border-warning/40 bg-warning/5">
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <div className="rounded-full bg-warning/15 p-2 text-warning">
          <AlertTriangle className="size-4" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-base">{t('instructorInterventions.liveRisk')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {context.studentName} · {context.assignmentTitle}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{t('instructorInterventions.riskLevel')}</span>
          <Badge variant={context.assessment.level === 'high' ? 'error' : 'warning'}>
            {riskLabels[context.assessment.level]}
          </Badge>
        </div>
        <ul className="space-y-2" aria-label={t('instructorInterventions.riskFactors')}>
          {context.assessment.factors.map((factor) => (
            <li
              key={`${factor.checkpointId}-${factor.type}`}
              className="flex items-start gap-2 text-sm"
            >
              <span
                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning"
                aria-hidden="true"
              />
              <span>{factorLabels[factor.type]}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
