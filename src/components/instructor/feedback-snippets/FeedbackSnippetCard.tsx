import { Archive, Edit3, RotateCcw } from 'lucide-react';
import type { FeedbackSnippet } from '@/server/feedback-snippets';
import { useI18n } from '@/routes/__root';
import { Button } from '@/components/ui/button';

interface FeedbackSnippetCardProps {
  snippet: FeedbackSnippet;
  archived: boolean;
  onArchive: (snippet: FeedbackSnippet) => void;
  onEdit: (snippet: FeedbackSnippet) => void;
  onRestore: (snippet: FeedbackSnippet) => void;
}

function FeedbackSnippetCard({
  snippet,
  archived,
  onArchive,
  onEdit,
  onRestore,
}: FeedbackSnippetCardProps) {
  const { t } = useI18n();

  return (
    <article className="flex h-full flex-col rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg text-foreground">{snippet.title}</h3>
          {snippet.category && (
            <span className="mt-1 inline-flex rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
              {snippet.category}
            </span>
          )}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {archived ? t('feedbackSnippets.archived') : t('feedbackSnippets.active')}
        </span>
      </div>

      <p className="mt-4 flex-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
        {snippet.body}
      </p>

      <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        <Button
          aria-label={t('feedbackSnippets.actions.edit', { title: snippet.title })}
          data-testid={`feedback-snippet-edit-${snippet.id}`}
          onClick={() => onEdit(snippet)}
          size="sm"
          variant="ghost"
        >
          <Edit3 aria-hidden="true" />
          {t('feedbackSnippets.edit')}
        </Button>
        {archived ? (
          <Button
            aria-label={t('feedbackSnippets.actions.restore', { title: snippet.title })}
            data-testid={`feedback-snippet-restore-${snippet.id}`}
            onClick={() => onRestore(snippet)}
            size="sm"
            variant="secondary"
          >
            <RotateCcw aria-hidden="true" />
            {t('feedbackSnippets.restore')}
          </Button>
        ) : (
          <Button
            aria-label={t('feedbackSnippets.actions.archive', { title: snippet.title })}
            data-testid={`feedback-snippet-archive-${snippet.id}`}
            onClick={() => onArchive(snippet)}
            size="sm"
            variant="destructive"
          >
            <Archive aria-hidden="true" />
            {t('feedbackSnippets.archive')}
          </Button>
        )}
      </div>
    </article>
  );
}

export { FeedbackSnippetCard };
