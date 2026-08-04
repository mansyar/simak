import { useI18n } from '../../routes/__root';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { RevisionActionItemInput } from '@/server/revision-action-items';
import type { RubricData } from '@/server/rubrics';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';

const MAX_ITEMS = 10;
const MAX_ITEM_LENGTH = 500;

interface RevisionActionPlanEditorProps {
  items: RevisionActionItemInput[];
  onChange: (items: RevisionActionItemInput[]) => void;
  rubric?: RubricData | null;
}

export function RevisionActionPlanEditor({
  items,
  onChange,
  rubric,
}: RevisionActionPlanEditorProps) {
  const { t } = useI18n();

  const updateItem = (index: number, update: Partial<RevisionActionItemInput>) => {
    onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...update } : item)));
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return;

    const nextItems = [...items];
    [nextItems[index], nextItems[nextIndex]] = [nextItems[nextIndex], nextItems[index]];
    onChange(nextItems);
  };

  return (
    <section
      className="space-y-3 rounded-md border bg-muted/20 p-3"
      aria-labelledby="action-plan-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="action-plan-title" className="text-sm font-medium">
            {t('instructorReviews.revisionActionPlan')}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t('instructorReviews.actionPlan.description')}
          </p>
        </div>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {t('instructorReviews.actionPlan.itemCount', { count: String(items.length) })}
        </span>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => {
          const isEmpty = item.itemText.trim().length === 0;
          const isTooLong = item.itemText.length > MAX_ITEM_LENGTH;
          const hasMarkup = /[<>]/.test(item.itemText);
          const error = isEmpty
            ? t('instructorReviews.actionPlan.itemRequired')
            : isTooLong
              ? t('instructorReviews.actionPlan.itemTooLong')
              : hasMarkup
                ? t('instructorReviews.actionPlan.itemPlainText')
                : null;
          const itemId = `revision-action-item-${index}`;
          const criterionId = `revision-action-criterion-${index}`;

          return (
            <div key={index} className="space-y-2 rounded-md border bg-background p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label htmlFor={itemId}>
                    {t('instructorReviews.actionPlan.itemLabel', { number: String(index + 1) })}
                  </Label>
                  <Textarea
                    id={itemId}
                    value={item.itemText}
                    maxLength={MAX_ITEM_LENGTH}
                    rows={2}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${itemId}-error` : undefined}
                    onChange={(event) => updateItem(index, { itemText: event.target.value })}
                  />
                  {error && (
                    <p id={`${itemId}-error`} className="text-xs text-destructive" role="alert">
                      {error}
                    </p>
                  )}
                </div>
                <div
                  className="flex shrink-0 gap-1"
                  aria-label={t('instructorReviews.actionPlan.reorderLabel')}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('instructorReviews.actionPlan.moveUp')}
                    disabled={index === 0}
                    onClick={() => moveItem(index, -1)}
                  >
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('instructorReviews.actionPlan.moveDown')}
                    disabled={index === items.length - 1}
                    onClick={() => moveItem(index, 1)}
                  >
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('instructorReviews.actionPlan.removeItem')}
                    onClick={() => removeItem(index)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>

              {rubric && rubric.criteria.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor={criterionId}>
                    {t('instructorReviews.actionPlan.criterionLabel')}
                  </Label>
                  <select
                    id={criterionId}
                    value={item.criterionId ?? ''}
                    onChange={(event) => {
                      const value = event.target.value;
                      updateItem(index, { criterionId: value ? Number(value) : undefined });
                    }}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">{t('instructorReviews.actionPlan.noCriterion')}</option>
                    {rubric.criteria.map((criterion) => (
                      <option key={criterion.id} value={criterion.id}>
                        {criterion.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={items.length >= MAX_ITEMS}
        onClick={() => onChange([...items, { itemText: '' }])}
      >
        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
        {t('instructorReviews.actionPlan.addItem')}
      </Button>
    </section>
  );
}
