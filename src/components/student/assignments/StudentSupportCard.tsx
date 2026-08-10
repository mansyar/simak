import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, HeartHandshake } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { isServerError } from '@/lib/errors';
import { useI18n } from '@/routes/__root';
import { getStudentSupportStatus } from '@/server/risk-history';

type SupportStatus = {
  status: 'on_track' | 'support_available';
  nextSteps: string[];
};

export function StudentSupportCard({ assignmentId }: { assignmentId: number }) {
  const { t } = useI18n();
  const [result, setResult] = useState<SupportStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const response = await getStudentSupportStatus({ data: { assignmentId } });
      if (isServerError(response)) setFailed(true);
      else setResult(response as SupportStatus);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Card role="status" aria-label={t('riskHistory.student.loading')}>
        <CardContent className="space-y-3 pt-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (failed) {
    return (
      <ErrorState
        title={t('riskHistory.student.error')}
        retryLabel={t('common.retry')}
        onRetry={() => void load()}
      />
    );
  }

  const supportAvailable = result?.status === 'support_available';
  return (
    <Card className="overflow-hidden border-primary/20" aria-labelledby="student-support-title">
      <CardHeader className="bg-primary/5">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2 text-primary" aria-hidden="true">
            {supportAvailable ? (
              <HeartHandshake className="h-5 w-5" />
            ) : (
              <CheckCircle2 className="h-5 w-5" />
            )}
          </div>
          <div>
            <CardTitle id="student-support-title">
              {supportAvailable
                ? t('riskHistory.student.supportAvailableTitle')
                : t('riskHistory.student.onTrackTitle')}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {supportAvailable
                ? t('riskHistory.student.supportAvailableDescription')
                : t('riskHistory.student.onTrackDescription')}
            </p>
          </div>
        </div>
      </CardHeader>
      {supportAvailable && (
        <CardContent className="pt-5">
          <h3 className="text-sm font-semibold">{t('riskHistory.student.nextSteps')}</h3>
          <ul className="mt-3 space-y-2">
            {result.nextSteps.map((step) => (
              <li
                key={step}
                className="flex min-h-11 items-center gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                {step === 'contact_instructor'
                  ? t('riskHistory.student.steps.contactInstructor')
                  : t('riskHistory.student.steps.reviewCurrentWork')}
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
