import { useEffect, useId, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { SearchIcon } from 'lucide-react';
import { useI18n } from '@/routes/__root';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getErrorTranslationKey, isServerError } from '@/lib/errors';
import { userKeys } from '@/lib/query-keys';
import { listUsers } from '@/server/users';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { cn } from '@/lib/utils';

export type StudentOption = { id: string; name: string; email: string | null };

type ReportStudentPickerProps = {
  value: string | null;
  onChange: (studentId: string | null) => void;
};

const STUDENT_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

export function ReportStudentPicker({ value, onChange }: ReportStudentPickerProps) {
  const { t } = useI18n();
  const baseId = useId();
  const listboxId = `${baseId}-student-listbox`;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const updateDebouncedSearch = useDebouncedCallback(setDebouncedSearch, SEARCH_DEBOUNCE_MS);

  const studentsQuery = useInfiniteQuery({
    queryKey: userKeys.list({ limit: STUDENT_PAGE_SIZE, search: debouncedSearch, role: 'student' }),
    queryFn: async ({ pageParam }) => {
      const result = await listUsers({
        data: {
          page: pageParam,
          limit: STUDENT_PAGE_SIZE,
          search: debouncedSearch,
          role: 'student',
        },
      });
      if (isServerError(result)) {
        throw new Error(t(getErrorTranslationKey(result.error.code)));
      }
      return result;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((count, page) => count + page.users.length, 0);
      return loaded < lastPage.total ? allPages.length + 1 : undefined;
    },
    retry: false,
  });

  const students = studentsQuery.data?.pages.flatMap((page) => page.users) ?? [];
  const total = studentsQuery.data?.pages[0]?.total ?? 0;
  const hasMore = studentsQuery.hasNextPage ?? false;
  const settled = !studentsQuery.isPending && !studentsQuery.isError;

  const optionId = (studentId: string) => `${listboxId}-option-${studentId}`;

  useEffect(() => {
    if (!activeId) return;
    document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  const selectStudent = (student: StudentOption) => {
    onChange(student.id === value ? null : student.id);
    setOpen(false);
    setActiveId(null);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setSearch(next);
    if (next === '') {
      updateDebouncedSearch.cancel();
      setDebouncedSearch('');
    } else {
      updateDebouncedSearch(next);
    }
    setActiveId(null);
  };

  const handleFocus = () => {
    if (students.length > 0) setOpen(true);
  };

  const handleBlur = () => {
    setOpen(false);
    setActiveId(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (students.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (!open) {
          setOpen(true);
          setActiveId(
            event.key === 'ArrowDown' ? optionId(students[0].id) : optionId(students.at(-1)!.id),
          );
          return;
        }
        const currentIndex = activeId
          ? students.findIndex((student) => optionId(student.id) === activeId)
          : -1;
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        const nextIndex = (currentIndex + direction + students.length) % students.length;
        setActiveId(optionId(students[nextIndex].id));
        break;
      }
      case 'Home':
        event.preventDefault();
        setOpen(true);
        setActiveId(optionId(students[0].id));
        break;
      case 'End':
        event.preventDefault();
        setOpen(true);
        setActiveId(optionId(students.at(-1)!.id));
        break;
      case 'Escape':
        event.preventDefault();
        setOpen(false);
        setActiveId(null);
        break;
      case 'Enter': {
        if (open && activeId) {
          event.preventDefault();
          const student = students.find((candidate) => optionId(candidate.id) === activeId);
          if (student) selectStudent(student);
        }
        break;
      }
      case 'Tab':
        setOpen(false);
        setActiveId(null);
        break;
    }
  };

  const showNoResults = settled && total === 0 && debouncedSearch !== '';
  const showEmpty = settled && total === 0 && debouncedSearch === '';

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{t('reports.student.label')}</legend>
      <div className="space-y-1.5">
        <Label htmlFor={`${baseId}-student-search`}>{t('reports.student.searchLabel')}</Label>
        <div className="relative">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={`${baseId}-student-search`}
            type="search"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeId ?? undefined}
            value={search}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={t('reports.student.searchPlaceholder')}
            className="pl-9"
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

      {settled && students.length > 0 && open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={t('reports.student.label')}
          className="max-h-60 space-y-1 overflow-y-auto"
        >
          {students.map((student) => {
            const selected = student.id === value;
            return (
              <div
                key={student.id}
                id={optionId(student.id)}
                role="option"
                aria-selected={selected}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveId(optionId(student.id))}
                onClick={() => selectStudent(student)}
                className={cn(
                  'flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm',
                  selected
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border bg-card text-foreground hover:bg-accent',
                  activeId === optionId(student.id) &&
                    'bg-accent text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring',
                )}
              >
                <span className="truncate font-medium">{student.name}</span>
                {student.email && (
                  <span className="truncate text-xs text-muted-foreground">{student.email}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {settled && hasMore && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => void studentsQuery.fetchNextPage()}
        >
          {t('reports.student.loadMore')}
        </Button>
      )}
    </fieldset>
  );
}
