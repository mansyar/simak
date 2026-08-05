import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isServerError } from '@/lib/errors';
import { feedbackSnippetKeys } from '@/lib/query-keys';
import {
  archiveFeedbackSnippet,
  createFeedbackSnippet,
  listFeedbackSnippets,
  restoreFeedbackSnippet,
  updateFeedbackSnippet,
} from '@/server/feedback-snippets';
import type { FeedbackSnippet } from '@/server/feedback-snippets';
import { useI18n } from '@/routes/__root';
import { FeedbackSnippetCard } from './FeedbackSnippetCard';
import { FeedbackSnippetForm, type FeedbackSnippetFormValues } from './FeedbackSnippetForm';

type FormState = { mode: 'create' } | { mode: 'edit'; snippet: FeedbackSnippet };

function resultOrThrow<T>(result: T | { error: unknown }, message: string): T {
  if (isServerError(result)) {
    throw new Error(message);
  }
  return result as T;
}

function FeedbackSnippetsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [archived, setArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [formState, setFormState] = useState<FormState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const snippetsQuery = useQuery({
    queryKey: feedbackSnippetKeys.list({ archived, search }),
    queryFn: async () =>
      resultOrThrow(
        await listFeedbackSnippets({
          data: { archived, search },
        }),
        t('errors.fetchFailed'),
      ),
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: FeedbackSnippetFormValues }) => {
      const result = id
        ? await updateFeedbackSnippet({ data: { id, ...values } })
        : await createFeedbackSnippet({ data: values });
      return resultOrThrow(result, t('errors.fetchFailed'));
    },
    onSuccess: (_result, variables) => {
      setFormState(null);
      setMutationError(null);
      setNotice(variables.id ? t('feedbackSnippets.updated') : t('feedbackSnippets.created'));
      void queryClient.invalidateQueries({ queryKey: feedbackSnippetKeys.all() });
    },
    onError: () => {
      setMutationError(t('errors.fetchFailed'));
      setNotice(null);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) =>
      resultOrThrow(await archiveFeedbackSnippet({ data: { id } }), t('errors.fetchFailed')),
    onSuccess: () => {
      setNotice(t('feedbackSnippets.archivedSuccess'));
      setMutationError(null);
      void queryClient.invalidateQueries({ queryKey: feedbackSnippetKeys.all() });
    },
    onError: () => setMutationError(t('errors.fetchFailed')),
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) =>
      resultOrThrow(await restoreFeedbackSnippet({ data: { id } }), t('errors.fetchFailed')),
    onSuccess: () => {
      setNotice(t('feedbackSnippets.restoredSuccess'));
      setMutationError(null);
      void queryClient.invalidateQueries({ queryKey: feedbackSnippetKeys.all() });
    },
    onError: () => setMutationError(t('errors.fetchFailed')),
  });

  const snippets: FeedbackSnippet[] =
    snippetsQuery.data && 'snippets' in snippetsQuery.data
      ? (snippetsQuery.data.snippets as FeedbackSnippet[])
      : [];
  const isMutationPending =
    saveMutation.isPending || archiveMutation.isPending || restoreMutation.isPending;

  const handleSave = async (values: FeedbackSnippetFormValues) => {
    const id = formState?.mode === 'edit' ? formState.snippet.id : undefined;
    await saveMutation.mutateAsync({ id, values });
  };

  const handleArchive = (snippet: FeedbackSnippet) => {
    if (window.confirm(t('feedbackSnippets.archiveConfirm'))) {
      archiveMutation.mutate(snippet.id);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('feedbackSnippets.title')}
        subtitle={t('feedbackSnippets.subtitle')}
        action={
          <Button
            data-testid="feedback-snippets-create"
            onClick={() => {
              setNotice(null);
              setMutationError(null);
              setFormState({ mode: 'create' });
            }}
          >
            <Plus aria-hidden="true" />
            {t('feedbackSnippets.newSnippet')}
          </Button>
        }
      />

      {notice && (
        <p
          role="status"
          className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary"
        >
          {notice}
        </p>
      )}
      {mutationError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {mutationError}
        </p>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            aria-label={t('feedbackSnippets.searchPlaceholder')}
            className="pl-9"
            maxLength={100}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('feedbackSnippets.searchPlaceholder')}
            value={search}
          />
        </div>
        <div
          className="flex rounded-lg bg-muted p-1"
          role="group"
          aria-label={t('feedbackSnippets.filterLabel')}
        >
          <Button
            data-testid="feedback-snippets-active-filter"
            onClick={() => setArchived(false)}
            size="sm"
            variant={archived ? 'ghost' : 'secondary'}
          >
            {t('feedbackSnippets.active')}
          </Button>
          <Button
            data-testid="feedback-snippets-archived-filter"
            onClick={() => setArchived(true)}
            size="sm"
            variant={archived ? 'secondary' : 'ghost'}
          >
            {t('feedbackSnippets.archived')}
          </Button>
        </div>
      </div>

      {formState && (
        <FeedbackSnippetForm
          isPending={saveMutation.isPending}
          onCancel={() => setFormState(null)}
          onSubmit={handleSave}
          snippet={formState.mode === 'edit' ? formState.snippet : undefined}
        />
      )}

      {snippetsQuery.isPending ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {t('feedbackSnippets.loading')}
        </div>
      ) : snippetsQuery.isError ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center">
          <p role="alert" className="text-sm text-destructive">
            {t('feedbackSnippets.loadError')}
          </p>
          <Button className="mt-4" onClick={() => void snippetsQuery.refetch()} variant="outline">
            {t('feedbackSnippets.retry')}
          </Button>
        </div>
      ) : snippets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <h2 className="font-display text-xl text-foreground">{t('feedbackSnippets.empty')}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {t('feedbackSnippets.emptyPrompt')}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {snippets.map((snippet) => (
            <FeedbackSnippetCard
              key={snippet.id}
              archived={archived}
              onArchive={handleArchive}
              onEdit={(selected) => {
                setNotice(null);
                setMutationError(null);
                setFormState({ mode: 'edit', snippet: selected });
              }}
              onRestore={(selected) => restoreMutation.mutate(selected.id)}
              snippet={snippet}
            />
          ))}
        </div>
      )}

      {isMutationPending && (
        <span className="sr-only" role="status">
          {t('common.saving')}
        </span>
      )}
    </div>
  );
}

export { FeedbackSnippetsPage };
