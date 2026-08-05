import { useEffect, useMemo, useState } from 'react';
import { getErrorTranslationKey, isServerError } from '@/lib/errors';
import {
  updateRevisionActionItem,
  type UpdateRevisionActionItemInput,
} from '@/server/revision-action-items';
import { useI18n } from '../../routes/__root';

export interface StudentRevisionActionItem {
  id: number;
  itemText: string;
  order: number;
  criterionId?: number | null;
  criterionTitle?: string | null;
  addressedAt?: Date | string | null;
}

interface RevisionActionPlanProps {
  items: StudentRevisionActionItem[];
  isCurrentPlan: boolean;
}

function sortItems(items: StudentRevisionActionItem[]) {
  return [...items].sort((a, b) => a.order - b.order || a.id - b.id);
}

export function RevisionActionPlan({ items, isCurrentPlan }: RevisionActionPlanProps) {
  const { t } = useI18n();
  const sortedItems = useMemo(() => sortItems(items), [items]);
  const [localItems, setLocalItems] = useState(sortedItems);
  const [pendingItemId, setPendingItemId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalItems(sortedItems);
  }, [sortedItems]);

  if (items.length === 0) return null;

  const title = isCurrentPlan
    ? t('studentRevisionActionPlan.current')
    : t('studentRevisionActionPlan.historical');
  const description = isCurrentPlan
    ? t('studentRevisionActionPlan.currentDescription')
    : t('studentRevisionActionPlan.historicalDescription');

  const handleToggle = async (item: StudentRevisionActionItem, addressed: boolean) => {
    const previousItems = localItems;
    setError(null);
    setPendingItemId(item.id);
    setLocalItems(
      localItems.map((currentItem) =>
        currentItem.id === item.id
          ? { ...currentItem, addressedAt: addressed ? new Date() : null }
          : currentItem,
      ),
    );

    const input: UpdateRevisionActionItemInput = { itemId: item.id, addressed };
    try {
      const result = await updateRevisionActionItem({ data: input });
      if (isServerError(result)) {
        setLocalItems(previousItems);
        setError(t(getErrorTranslationKey(result.error.code)));
      }
    } catch {
      setLocalItems(previousItems);
      setError(t('studentRevisionActionPlan.updateError'));
    } finally {
      setPendingItemId(null);
    }
  };

  return (
    <section
      className="space-y-3 rounded-lg border bg-card p-4 shadow-sm"
      aria-labelledby="student-revision-action-plan-title"
    >
      <div>
        <h2 id="student-revision-action-plan-title" className="text-base font-semibold">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <ol className="space-y-2" aria-label={t('studentRevisionActionPlan.listLabel')}>
        {localItems.map((item, index) => {
          const addressed = Boolean(item.addressedAt);
          const label = t('studentRevisionActionPlan.item', { number: String(index + 1) });

          return (
            <li key={item.id} className="flex items-start gap-3 rounded-md border p-3">
              {isCurrentPlan ? (
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  checked={addressed}
                  disabled={pendingItemId !== null}
                  aria-label={label}
                  onChange={(event) => handleToggle(item, event.target.checked)}
                />
              ) : (
                <span
                  className="mt-1 h-4 w-4 shrink-0 rounded border border-muted-foreground/50"
                  aria-hidden="true"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className={addressed ? 'text-sm text-muted-foreground line-through' : 'text-sm'}>
                  {item.itemText}
                </p>
                {item.criterionTitle && (
                  <p className="mt-1 text-xs text-muted-foreground">{item.criterionTitle}</p>
                )}
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {addressed
                    ? t('studentRevisionActionPlan.addressed')
                    : t('studentRevisionActionPlan.open')}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {error && (
        <p className="text-sm text-destructive" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </section>
  );
}
