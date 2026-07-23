import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X, ChevronUp, ChevronDown } from 'lucide-react';
import { useI18n } from '../../../routes/__root';

export interface LevelInput {
  id?: number;
  label: string;
  description: string;
  score: number;
  order: number;
}

interface RubricLevelsEditorProps {
  levels: LevelInput[];
  onLevelsChange: (levels: LevelInput[]) => void;
}

export function RubricLevelsEditor({ levels, onLevelsChange }: RubricLevelsEditorProps) {
  const { t } = useI18n();

  const handleAdd = useCallback(() => {
    onLevelsChange([...levels, { label: '', description: '', score: 0, order: levels.length }]);
  }, [levels, onLevelsChange]);

  const handleRemove = useCallback(
    (index: number) => {
      onLevelsChange(levels.filter((_, i) => i !== index).map((l, i) => ({ ...l, order: i })));
    },
    [levels, onLevelsChange],
  );

  const handleChange = useCallback(
    (index: number, field: keyof LevelInput, value: string | number) => {
      onLevelsChange(levels.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
    },
    [levels, onLevelsChange],
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index === 0) return;
      const updated = [...levels];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      onLevelsChange(updated.map((l, i) => ({ ...l, order: i })));
    },
    [levels, onLevelsChange],
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= levels.length - 1) return;
      const updated = [...levels];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      onLevelsChange(updated.map((l, i) => ({ ...l, order: i })));
    },
    [levels, onLevelsChange],
  );

  return (
    <div className="space-y-3 pl-12">
      {levels.map((level, index) => (
        <div key={level.id ?? `new-${index}`} className="space-y-1 rounded border p-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={() => handleMoveUp(index)}
              disabled={index === 0}
              className="p-0.5"
              aria-label={t('rubrics.levels.moveUp')}
            >
              <ChevronUp className="h-3 w-3" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={() => handleMoveDown(index)}
              disabled={index === levels.length - 1}
              className="p-0.5"
              aria-label={t('rubrics.levels.moveDown')}
            >
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            </Button>
            <Input
              value={level.label}
              onChange={(e) => handleChange(index, 'label', e.target.value)}
              placeholder={t('rubrics.levels.labelPlaceholder')}
              data-testid={`level-label-${index}`}
            />
            <Input
              type="number"
              min={0}
              max={100}
              value={level.score}
              onChange={(e) =>
                handleChange(index, 'score', Math.max(0, Math.min(100, Number(e.target.value))))
              }
              className="w-20"
              data-testid={`level-score-${index}`}
              aria-label={t('rubrics.levels.scoreLabel')}
            />
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={() => handleRemove(index)}
              aria-label={t('rubrics.levels.remove')}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <Input
            value={level.description}
            onChange={(e) => handleChange(index, 'description', e.target.value)}
            placeholder={t('rubrics.levels.descriptionPlaceholder')}
            data-testid={`level-description-${index}`}
          />
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
        {t('rubrics.levels.add')}
      </Button>
    </div>
  );
}
