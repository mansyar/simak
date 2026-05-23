import { useI18n } from '../../routes/__root';

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

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <select
          value={selectedAssignmentId ?? ''}
          onChange={(e) => onAssignmentChange(e.target.value ? Number(e.target.value) : null)}
          className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          data-testid="assignment-filter"
        >
          <option value="">{t('instructorReviews.allAssignments')}</option>
          {assignments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
