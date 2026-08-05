import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { isServerError } from '@/lib/errors';
import { feedbackSnippetKeys } from '@/lib/query-keys';
import { useI18n } from '@/routes/__root';
import { listFeedbackSnippets, type FeedbackSnippetListItem } from '@/server/feedback-snippets';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';

interface FeedbackSnippetPickerProps {
  onInsert: (body: string) => void;
}

function FeedbackSnippetPicker({ onInsert }: FeedbackSnippetPickerProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const updateDebouncedSearch = useDebouncedCallback(setDebouncedSearch, 300);

  const snippetsQuery = useQuery({
    queryKey: feedbackSnippetKeys.list({
      archived: false,
      search: debouncedSearch,
      page,
      limit: 20,
    }),
    queryFn: async () => {
      const result = await listFeedbackSnippets({
        data: { archived: false, search: debouncedSearch, page, limit: 20 },
      });

      if (isServerError(result)) {
        throw new Error(t('errors.fetchFailed'));
      }

      return result;
    },
    placeholderData: (previousData) => previousData,
  });

  const snippets: FeedbackSnippetListItem[] =
    snippetsQuery.data?.snippets.filter((snippet) => !snippet.archivedAt) ?? [];
  const selectedSnippet = snippets.find((snippet) => snippet.id === selectedId) ?? null;
  const total = snippetsQuery.data?.total ?? snippets.length;
  const totalPages = Math.ceil(total / 20);

  return (
    <section
      aria-labelledby="feedback-snippet-picker-title"
      className="space-y-3 rounded-lg border border-border bg-muted/30 p-3"
    >
      <div>
        <h3 id="feedback-snippet-picker-title" className="text-sm font-medium">
          {t('feedbackSnippets.pickerTitle')}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('feedbackSnippets.pickerDescription')}
        </p>
      </div>

      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          aria-label={t('feedbackSnippets.pickerSearchPlaceholder')}
          className="pl-9"
          onChange={(event) => {
            const value = event.target.value;
            setSearch(value);
            setPage(1);
            if (value === '') {
              updateDebouncedSearch.cancel();
              setDebouncedSearch('');
            } else {
              updateDebouncedSearch(value);
            }
            setSelectedId(null);
          }}
          placeholder={t('feedbackSnippets.pickerSearchPlaceholder')}
          type="search"
          value={search}
        />
      </div>

      {snippetsQuery.isPending ? (
        <p className="text-sm text-muted-foreground">{t('feedbackSnippets.pickerLoading')}</p>
      ) : snippetsQuery.isError ? (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-destructive">
            {t('feedbackSnippets.pickerLoadError')}
          </p>
          <Button onClick={() => void snippetsQuery.refetch()} size="sm" variant="outline">
            {t('feedbackSnippets.retry')}
          </Button>
        </div>
      ) : snippets.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('feedbackSnippets.pickerEmpty')}</p>
      ) : (
        <>
          <div
            aria-label={t('feedbackSnippets.pickerTitle')}
            className="grid gap-2 sm:grid-cols-2"
            role="group"
          >
            {snippets.map((snippet) => {
              const isSelected = selectedId === snippet.id;

              return (
                <Button
                  key={snippet.id}
                  aria-pressed={isSelected}
                  className="h-auto justify-start whitespace-normal text-left"
                  data-testid={`feedback-snippet-option-${snippet.id}`}
                  onClick={() => setSelectedId(snippet.id)}
                  type="button"
                  variant={isSelected ? 'secondary' : 'outline'}
                >
                  <span>
                    <span className="block font-medium">{snippet.title}</span>
                    {snippet.category && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {snippet.category}
                      </span>
                    )}
                  </span>
                </Button>
              );
            })}
          </div>
          {totalPages > 1 && (
            <Pagination
              currentPage={page}
              onPageChange={setPage}
              showCounter
              showPageNumbers
              totalPages={totalPages}
            />
          )}
        </>
      )}

      {selectedSnippet && (
        <div className="space-y-2 rounded-md border border-border bg-background p-3">
          <p className="text-xs font-medium text-muted-foreground">
            {t('feedbackSnippets.pickerSelected')}
          </p>
          <p className="whitespace-pre-wrap text-sm">{selectedSnippet.body}</p>
          <Button
            data-testid="feedback-snippet-insert"
            onClick={() => onInsert(selectedSnippet.body)}
            type="button"
          >
            {t('feedbackSnippets.pickerInsert')}
          </Button>
        </div>
      )}
    </section>
  );
}

export { FeedbackSnippetPicker };
