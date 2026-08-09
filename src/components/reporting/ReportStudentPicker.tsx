import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SearchIcon } from 'lucide-react';
import { useI18n } from '@/routes/__root';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getErrorTranslationKey, isServerError } from '@/lib/errors';
import { userKeys } from '@/lib/query-keys';
import { listUsers } from '@/server/users';
import { cn } from '@/lib/utils';

export type StudentOption = { id: string; name: string; email: string | null };

type ReportStudentPickerProps = {
  value: string | null;
  onChange: (studentId: string | null) => void;
};

const STUDENT_PAGE_SIZE = 500;

export function ReportStudentPicker({ value, onChange }: ReportStudentPickerProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');

  const studentsQuery = useQuery({
    queryKey: userKeys.list({ page: 1, limit: STUDENT_PAGE_SIZE, search: '', role: 'student' }),
    queryFn: async () => {
      const result = await listUsers({
        data: { page: 1, limit: STUDENT_PAGE_SIZE, search: '', role: 'student' },
      });
      if (isServerError(result)) {
        throw new Error(t(getErrorTranslationKey(result.error.code)));
      }
      return result;
    },
    retry: false,
  });

  const filtered = useMemo(() => {
    const students = studentsQuery.data?.users ?? [];
    const needle = search.trim().toLowerCase();
    if (!needle) return students;
    return students.filter((student) => {
      const name = (student.name ?? '').toLowerCase();
      const email = (student.email ?? '').toLowerCase();
      return name.includes(needle) || email.includes(needle);
    });
  }, [studentsQuery.data, search]);

  const studentCount = studentsQuery.data?.users.length ?? 0;
  const showNoResults = studentsQuery.data && studentCount > 0 && filtered.length === 0;
  const showEmpty = studentsQuery.data && studentCount === 0;

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{t('reports.student.label')}</legend>
      <div className="space-y-1.5">
        <Label htmlFor="report-student-search">{t('reports.student.searchLabel')}</Label>
        <div className="relative">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="report-student-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('reports.student.searchPlaceholder')}
            className="pl-9"
            aria-controls="report-student-listbox"
          />
        </div>
      </div>

      {studentsQuery.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('reports.student.loading')}
        </p>
      )}

      {studentsQuery.isError && (
        <ErrorState
          title={t('reports.student.loadError')}
          retryLabel={t('common.retry')}
          onRetry={() => studentsQuery.refetch()}
          className="p-4"
        />
      )}

      {showEmpty && (
        <EmptyState icon={SearchIcon} compact title={t('reports.student.empty')} className="py-6" />
      )}

      {showNoResults && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('reports.student.noResults')}
        </p>
      )}

      {studentsQuery.data && filtered.length > 0 && (
        <div
          id="report-student-listbox"
          role="listbox"
          aria-label={t('reports.student.label')}
          className="max-h-60 space-y-1 overflow-y-auto"
        >
          {filtered.map((student) => {
            const selected = student.id === value;
            return (
              <button
                key={student.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onChange(selected ? null : student.id)}
                className={cn(
                  'flex min-h-11 w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border bg-card text-foreground hover:bg-accent',
                )}
              >
                <span className="truncate font-medium">{student.name}</span>
                {student.email && (
                  <span className="truncate text-xs text-muted-foreground">{student.email}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
