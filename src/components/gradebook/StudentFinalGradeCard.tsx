import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/routes/__root';
import { getStudentFinalGrade } from '@/server/gradebook';
import { isServerError } from '@/lib/errors';
import { gradebookKeys } from '@/lib/query-keys';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, ChevronUp } from 'lucide-react';

export function StudentFinalGradeCard({ assignmentId }: { assignmentId: number }) {
  const { t } = useI18n();
  const [showBreakdown, setShowBreakdown] = useState(false);
  const {
    data: grade,
    isPending,
    isError,
  } = useQuery({
    queryKey: gradebookKeys.studentFinalGrade(assignmentId),
    queryFn: async () => {
      const result = await getStudentFinalGrade({ data: { assignmentId } });
      if (isServerError(result)) throw result;
      return result;
    },
  });

  if (isPending) {
    return (
      <Card>
        <CardHeader>
          <Skeleton data-testid="grade-card-skeleton" className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          {t('gradebook.loadError')}
        </CardContent>
      </Card>
    );
  }

  if (!grade) {
    return null;
  }

  if ('available' in grade && !grade.available) {
    return (
      <Card data-testid="student-final-grade-card">
        <CardHeader>
          <CardTitle>{t('gradebook.student.unavailable')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {t('gradebook.student.notYetReleased')}
        </CardContent>
      </Card>
    );
  }

  if (grade.status === undefined || grade.contributingCheckpoints === undefined) {
    return null;
  }

  const statusBadge: Record<
    string,
    { variant: 'success' | 'warning' | 'secondary'; label: string }
  > = {
    complete: { variant: 'success', label: t('gradebook.status.complete') },
    in_progress: { variant: 'warning', label: t('gradebook.status.in_progress') },
    incomplete: { variant: 'secondary', label: t('gradebook.status.incomplete') },
  };
  const status = statusBadge[grade.status] ?? statusBadge.incomplete;
  const releaseVersion = 'available' in grade ? grade.releaseVersion : null;

  return (
    <Card data-testid="student-final-grade-card">
      <CardHeader>
        <CardTitle>{t('gradebook.student.finalGrade')}</CardTitle>
        {releaseVersion !== null && (
          <p className="text-sm text-muted-foreground">
            {t('gradebook.student.releaseVersion')}: {releaseVersion}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          {grade.status === 'complete' && (
            <>
              <span className="text-2xl font-bold">{grade.numericScore}</span>
              <Badge variant="success">{grade.letterGrade}</Badge>
            </>
          )}
          {grade.status === 'in_progress' && (
            <>
              <span className="text-2xl font-bold">{grade.numericScore}</span>
              <span className="text-sm text-muted-foreground">
                {t('gradebook.student.currentProgress')}
              </span>
            </>
          )}
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>

        {grade.contributingCheckpoints.length > 0 && (
          <>
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={showBreakdown}
              aria-controls="student-grade-breakdown"
              onClick={() => setShowBreakdown(!showBreakdown)}
            >
              {t('gradebook.student.breakdown')}
              {showBreakdown ? (
                <ChevronUp className="ml-1 h-4 w-4" />
              ) : (
                <ChevronDown className="ml-1 h-4 w-4" />
              )}
            </Button>

            {showBreakdown && (
              <table id="student-grade-breakdown" className="w-full text-sm">
                <caption className="sr-only">{t('gradebook.student.breakdown')}</caption>
                <thead>
                  <tr className="border-b">
                    <th scope="col" className="py-2 text-left font-medium">
                      {t('gradebook.student.checkpoint')}
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      {t('gradebook.student.score')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {grade.contributingCheckpoints.map((cp) => (
                    <tr key={cp.checkpointId} className="border-b">
                      <td className="py-2">{cp.checkpointName}</td>
                      <td className="py-2 text-right">
                        {cp.isRubric
                          ? (cp.score ?? t('gradebook.student.scoreUnavailable'))
                          : cp.state === 'passed'
                            ? t('gradebook.passed')
                            : t('gradebook.notPassed')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
