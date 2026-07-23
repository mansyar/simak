import { useState, useEffect, useCallback } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { getRubric, saveRubric, countPendingReviews } from '@/server/rubrics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, X, ChevronUp, ChevronDown } from 'lucide-react';
import { RubricLevelsEditor, type LevelInput } from './RubricLevelsEditor';
import { useI18n } from '../../../routes/__root';

interface CriterionInput {
  id?: number;
  title: string;
  description: string;
  weight: number;
  order: number;
}

interface RubricCriteriaEditorProps {
  templateCheckpointId: number;
  gradingType: 'numeric' | 'qualitative';
}

export function RubricCriteriaEditor({
  templateCheckpointId,
  gradingType,
}: RubricCriteriaEditorProps) {
  const { t } = useI18n();
  const getRubricFn = useServerFn(getRubric);
  const saveRubricFn = useServerFn(saveRubric);
  const countPendingReviewsFn = useServerFn(countPendingReviews);

  const [criteria, setCriteria] = useState<CriterionInput[]>([]);
  const [levels, setLevels] = useState<LevelInput[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchRubric = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getRubricFn({ data: { templateCheckpointId } });
        if (cancelled) return;
        if (result && 'error' in result) {
          setError(result.error.message);
        } else if (result) {
          setCriteria(
            result.criteria.map((c) => ({
              id: c.id,
              title: c.title,
              description: c.description ?? '',
              weight: c.weight,
              order: c.order,
            })),
          );
          setLevels(
            result.levels.map((l) => ({
              id: l.id,
              label: l.label,
              description: l.description ?? '',
              score: l.score,
              order: l.order,
            })),
          );
        }
      } catch {
        if (!cancelled) setError(t('rubrics.criteria.loadError'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchRubric();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateCheckpointId]);

  const weightSum = criteria.reduce((sum, c) => sum + c.weight, 0);
  const isValid =
    criteria.length > 0 && weightSum === 100 && (gradingType === 'numeric' || levels.length > 0);

  const handleAdd = useCallback(() => {
    setCriteria((prev) => [...prev, { title: '', description: '', weight: 0, order: prev.length }]);
  }, []);

  const handleRemove = useCallback((index: number) => {
    setCriteria((prev) => prev.filter((_, i) => i !== index).map((c, i) => ({ ...c, order: i })));
  }, []);

  const handleChange = useCallback(
    (index: number, field: keyof CriterionInput, value: string | number) => {
      setCriteria((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: value };
        return updated;
      });
    },
    [],
  );

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    setCriteria((prev) => {
      const updated = [...prev];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      return updated.map((c, i) => ({ ...c, order: i }));
    });
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    setCriteria((prev) => {
      if (index >= prev.length - 1) return prev;
      const updated = [...prev];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      return updated.map((c, i) => ({ ...c, order: i }));
    });
  }, []);

  const doSave = async () => {
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
      const result = await saveRubricFn({
        data: {
          templateCheckpointId,
          gradingType,
          criteria,
          levels,
        },
      });
      if (result && 'error' in result) {
        setError(result.error.message);
      } else {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch {
      setError(t('rubrics.criteria.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!isValid || isSaving) return;
    try {
      const countResult = await countPendingReviewsFn({ data: { templateCheckpointId } });
      if (countResult && 'error' in countResult) {
        setError(countResult.error.message);
        return;
      }
      if (countResult.count > 0) {
        setPendingCount(countResult.count);
        setShowConfirmDialog(true);
        return;
      }
      await doSave();
    } catch {
      setError(t('rubrics.criteria.saveError'));
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground pl-12">{t('rubrics.criteria.loading')}</p>;
  }

  return (
    <div className="space-y-3 pl-12">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {saveSuccess && <p className="text-sm text-green-600">{t('rubrics.criteria.saveSuccess')}</p>}

      {criteria.map((criterion, index) => (
        <div key={index} className="space-y-1 rounded border p-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={() => handleMoveUp(index)}
              disabled={index === 0}
              className="p-0.5"
              aria-label={t('rubrics.criteria.moveUp')}
            >
              <ChevronUp className="h-3 w-3" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={() => handleMoveDown(index)}
              disabled={index === criteria.length - 1}
              className="p-0.5"
              aria-label={t('rubrics.criteria.moveDown')}
            >
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            </Button>
            <Input
              value={criterion.title}
              onChange={(e) => handleChange(index, 'title', e.target.value)}
              placeholder={t('rubrics.criteria.titlePlaceholder')}
              data-testid={`criterion-title-${index}`}
            />
            <Input
              type="number"
              min={0}
              max={100}
              value={criterion.weight}
              onChange={(e) =>
                handleChange(index, 'weight', Math.max(0, Math.min(100, Number(e.target.value))))
              }
              className="w-20"
              data-testid={`criterion-weight-${index}`}
            />
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={() => handleRemove(index)}
              aria-label={t('rubrics.criteria.remove')}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <Input
            value={criterion.description}
            onChange={(e) => handleChange(index, 'description', e.target.value)}
            placeholder={t('rubrics.criteria.descriptionPlaceholder')}
            data-testid={`criterion-description-${index}`}
          />
        </div>
      ))}

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          {t('rubrics.criteria.add')}
        </Button>
        <span
          className={weightSum === 100 ? 'text-sm text-green-600' : 'text-sm text-destructive'}
          data-testid="weight-sum"
        >
          {t('rubrics.criteria.weightSum', { sum: String(weightSum) })}
        </span>
      </div>

      {gradingType === 'qualitative' && (
        <RubricLevelsEditor levels={levels} onLevelsChange={setLevels} />
      )}

      <Button
        type="button"
        onClick={handleSave}
        disabled={!isValid || isSaving}
        data-testid="save-rubric"
      >
        {isSaving ? t('rubrics.criteria.saving') : t('rubrics.criteria.save')}
      </Button>

      <Dialog
        open={showConfirmDialog}
        onOpenChange={(open) => {
          if (!open) setShowConfirmDialog(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('rubrics.criteria.pendingReviewsTitle')}</DialogTitle>
            <DialogDescription>
              {t('rubrics.criteria.pendingReviewsWarning', { count: String(pendingCount) })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                setShowConfirmDialog(false);
                doSave();
              }}
            >
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
