import { useI18n } from '../../routes/__root';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';

interface ReviewQueueFiltersProps {
  assignments: { id: number; title: string }[];
  selectedAssignmentId: number | null;
  onAssignmentChange: (id: number | null) => void;
}

export function ReviewQueueFilters({
  assignments,
  selectedAssignmentId,
  onAssignmentChange,
}: ReviewQueueFiltersProps) {
  const { t } = useI18n();

  const value = selectedAssignmentId !== null ? String(selectedAssignmentId) : 'all';

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="w-full sm:w-[240px]">
        <Select
          value={value}
          onValueChange={(val) => onAssignmentChange(val === 'all' ? null : Number(val))}
        >
          <SelectTrigger
            aria-label={t('instructorReviews.assignmentFilterLabel')}
            className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring"
            data-testid="assignment-filter"
          >
            <span>
              {value === 'all'
                ? t('instructorReviews.allAssignments')
                : (assignments.find((a) => a.id === Number(value))?.title ??
                  t('instructorReviews.allAssignments'))}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('instructorReviews.allAssignments')}</SelectItem>
            {assignments.map((a) => (
              <SelectItem key={a.id} value={String(a.id)}>
                {a.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
