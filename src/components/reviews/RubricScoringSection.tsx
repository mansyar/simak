import { useI18n } from '@/routes/__root';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { RubricData } from '@/server/rubrics';

export interface ScoreInput {
  criterionId: number;
  score: number;
  rubricLevelId?: number;
  comment?: string;
}

interface RubricScoringSectionProps {
  rubric: RubricData;
  scores: ScoreInput[];
  onScoresChange: (scores: ScoreInput[]) => void;
}

export function RubricScoringSection({
  rubric,
  scores,
  onScoresChange,
}: RubricScoringSectionProps) {
  const { t } = useI18n();

  const handleScoreChange = (criterionId: number, value: string) => {
    const numValue = Number(value);
    const clampedScore = Math.max(0, Math.min(100, isNaN(numValue) ? 0 : numValue));
    const existing = scores.find((s) => s.criterionId === criterionId);
    if (existing) {
      onScoresChange(
        scores.map((s) => (s.criterionId === criterionId ? { ...s, score: clampedScore } : s)),
      );
    } else {
      onScoresChange([...scores, { criterionId, score: clampedScore }]);
    }
  };

  const handleLevelChange = (criterionId: number, levelIdStr: string) => {
    const levelId = Number(levelIdStr);
    const level = rubric.levels.find((l) => l.id === levelId);
    if (!level) return;
    const existing = scores.find((s) => s.criterionId === criterionId);
    if (existing) {
      onScoresChange(
        scores.map((s) =>
          s.criterionId === criterionId ? { ...s, score: level.score, rubricLevelId: level.id } : s,
        ),
      );
    } else {
      onScoresChange([...scores, { criterionId, score: level.score, rubricLevelId: level.id }]);
    }
  };

  const weightedTotal = rubric.criteria.reduce((sum, criterion) => {
    const score = scores.find((s) => s.criterionId === criterion.id)?.score;
    if (score === undefined) return sum;
    return sum + (score * criterion.weight) / 100;
  }, 0);

  const allScored = rubric.criteria.every((c) => scores.some((s) => s.criterionId === c.id));

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm">{t('instructorReviews.rubric.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rubric.criteria.map((criterion) => {
          const score = scores.find((s) => s.criterionId === criterion.id)?.score;
          return (
            <div key={criterion.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>{criterion.title}</Label>
                <span className="text-xs text-muted-foreground">{criterion.weight}%</span>
              </div>
              {criterion.description && (
                <p className="text-xs text-muted-foreground">{criterion.description}</p>
              )}
              {rubric.gradingType === 'qualitative' ? (
                <Select
                  value={
                    scores.find((s) => s.criterionId === criterion.id)?.rubricLevelId?.toString() ??
                    ''
                  }
                  onValueChange={(value) => value && handleLevelChange(criterion.id, value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('instructorReviews.rubric.selectLevel')} />
                  </SelectTrigger>
                  <SelectContent>
                    {rubric.levels.map((level) => (
                      <SelectItem key={level.id} value={level.id.toString()}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={score ?? ''}
                    onChange={(e) => handleScoreChange(criterion.id, e.target.value)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">/ 100</span>
                </div>
              )}
            </div>
          );
        })}
        <div className="flex items-center justify-between border-t pt-2">
          <span className="text-sm font-medium">{t('instructorReviews.rubric.weightedTotal')}</span>
          <span className="text-sm font-medium">{`${Math.round(weightedTotal)} / 100`}</span>
        </div>
        {!allScored && (
          <p className="text-xs text-destructive">
            {t('instructorReviews.rubric.allCriteriaRequired')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
