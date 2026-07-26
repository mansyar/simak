import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/routes/__root';
import type { AssignmentGradeConfig } from '@/lib/grade-computation';

interface GradeConfigSummaryProps {
  config: AssignmentGradeConfig | null;
  staleWeights?: boolean;
}

export function GradeConfigSummary({ config, staleWeights }: GradeConfigSummaryProps) {
  const { t } = useI18n();

  if (!config) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('gradebook.configSummary')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('gradebook.noGrades')}</p>
        </CardContent>
      </Card>
    );
  }

  const bounds = Object.entries(config.letterGradeBounds)
    .sort(([, a], [, b]) => b - a)
    .map(([letter, bound]) => `${letter}: ${bound}`)
    .join(', ');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('gradebook.configSummary')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('gradebook.configScheme')}</span>
          <Badge variant="secondary">
            {config.gradingScheme === 'equal_weight'
              ? t('gradebook.equalWeight')
              : t('gradebook.customWeight')}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('gradebook.letterBounds')}</span>
          <span className="text-sm">{bounds}</span>
        </div>
        {config.gradingScheme === 'custom_weight' && config.customWeights && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('gradebook.customWeights')}</span>
            <span className="text-sm">
              {Object.entries(config.customWeights)
                .map(([id, w]) => `${id}: ${w}%`)
                .join(', ')}
            </span>
          </div>
        )}
        {staleWeights && <Badge variant="warning">{t('gradebook.staleWeightsWarning')}</Badge>}
      </CardContent>
    </Card>
  );
}
