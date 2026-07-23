import { useI18n } from '../../routes/__root';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface ReviewScoreSnapshot {
  id: number;
  criterionId: number;
  criterionTitle: string;
  score: number;
  weight: number;
  rubricLevelId: number | null;
  levelLabel: string | null;
  comment: string | null;
}

interface RubricResultViewProps {
  scores: ReviewScoreSnapshot[];
}

export function RubricResultView({ scores }: RubricResultViewProps) {
  const { t } = useI18n();

  if (scores.length === 0) {
    return null;
  }

  const weightedTotal = Math.round(scores.reduce((sum, s) => sum + (s.score * s.weight) / 100, 0));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('studentRubrics.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {scores.map((score) => (
          <div key={score.id} className="space-y-1 border-b border-border pb-3 last:border-0">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{score.criterionTitle}</span>
              <Badge variant="secondary">{score.score}</Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{score.weight}%</span>
              {score.levelLabel && <span>{score.levelLabel}</span>}
            </div>
            {score.comment && <p className="text-sm text-muted-foreground">{score.comment}</p>}
          </div>
        ))}
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm font-semibold text-foreground">
            {t('studentRubrics.weightedTotal')}
          </span>
          <span data-testid="weighted-total" className="text-lg font-bold text-foreground">
            {weightedTotal}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
