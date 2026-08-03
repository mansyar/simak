import { useEffect, useState } from 'react';
import { CreateFeedbackSnippetSchema } from '@/server/feedback-snippets';
import type { FeedbackSnippetListItem } from '@/server/feedback-snippets';
import { useI18n } from '@/routes/__root';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type FeedbackSnippetFormValues = {
  title: string;
  category: string | null;
  body: string;
};

interface FeedbackSnippetFormProps {
  snippet?: FeedbackSnippetListItem;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (values: FeedbackSnippetFormValues) => Promise<void>;
}

type FormErrors = Partial<Record<keyof FeedbackSnippetFormValues, string>>;

function FeedbackSnippetForm({ snippet, isPending, onCancel, onSubmit }: FeedbackSnippetFormProps) {
  const { t } = useI18n();
  const [values, setValues] = useState({
    title: snippet?.title ?? '',
    category: snippet?.category ?? '',
    body: snippet?.body ?? '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    setValues({
      title: snippet?.title ?? '',
      category: snippet?.category ?? '',
      body: snippet?.body ?? '',
    });
    setErrors({});
  }, [snippet]);

  const updateValue = (field: keyof typeof values, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const getValidationMessage = (field: keyof FormErrors, message: string) => {
    if (field === 'title' && message.includes('required')) {
      return t('feedbackSnippets.validation.titleRequired');
    }
    if (field === 'body' && message.includes('required')) {
      return t('feedbackSnippets.validation.bodyRequired');
    }
    if (field === 'title' && message.includes('100')) {
      return t('feedbackSnippets.validation.titleTooLong');
    }
    if (field === 'category' && message.includes('50')) {
      return t('feedbackSnippets.validation.categoryTooLong');
    }
    if (field === 'body' && message.includes('2000')) {
      return t('feedbackSnippets.validation.bodyTooLong');
    }
    return t('feedbackSnippets.validation.plainText');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = CreateFeedbackSnippetSchema.safeParse({
      title: values.title,
      category: values.category,
      body: values.body,
    });

    if (!parsed.success) {
      const nextErrors: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FormErrors;
        if (field === 'title' || field === 'category' || field === 'body') {
          nextErrors[field] ??= getValidationMessage(field, issue.message);
        }
      }
      setErrors(nextErrors);
      return;
    }

    await onSubmit({ ...parsed.data, category: parsed.data.category ?? null });
  };

  return (
    <form
      className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6"
      onSubmit={handleSubmit}
      noValidate
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="font-display text-xl text-foreground">
          {snippet ? t('feedbackSnippets.editSnippet') : t('feedbackSnippets.newSnippet')}
        </h2>
        <span className="text-xs text-muted-foreground">{t('feedbackSnippets.plainTextOnly')}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-foreground">
            {t('feedbackSnippets.titleLabel')}
          </span>
          <Input
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? 'feedback-snippet-title-error' : undefined}
            aria-label={t('feedbackSnippets.titleLabel')}
            maxLength={100}
            onChange={(event) => updateValue('title', event.target.value)}
            placeholder={t('feedbackSnippets.titlePlaceholder')}
            value={values.title}
          />
          {errors.title && (
            <p id="feedback-snippet-title-error" role="alert" className="text-xs text-destructive">
              {errors.title}
            </p>
          )}
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-foreground">
            {t('feedbackSnippets.categoryLabel')}
          </span>
          <Input
            aria-invalid={Boolean(errors.category)}
            aria-describedby={errors.category ? 'feedback-snippet-category-error' : undefined}
            aria-label={t('feedbackSnippets.categoryLabel')}
            maxLength={50}
            onChange={(event) => updateValue('category', event.target.value)}
            placeholder={t('feedbackSnippets.categoryPlaceholder')}
            value={values.category}
          />
          {errors.category && (
            <p
              id="feedback-snippet-category-error"
              role="alert"
              className="text-xs text-destructive"
            >
              {errors.category}
            </p>
          )}
        </label>
      </div>

      <label className="mt-4 block space-y-1.5">
        <span className="text-sm font-medium text-foreground">
          {t('feedbackSnippets.bodyLabel')}
        </span>
        <Textarea
          aria-invalid={Boolean(errors.body)}
          aria-describedby={errors.body ? 'feedback-snippet-body-error' : undefined}
          aria-label={t('feedbackSnippets.bodyLabel')}
          maxLength={2000}
          onChange={(event) => updateValue('body', event.target.value)}
          placeholder={t('feedbackSnippets.bodyPlaceholder')}
          rows={5}
          value={values.body}
        />
        <div className="flex items-start justify-between gap-3">
          {errors.body ? (
            <p id="feedback-snippet-body-error" role="alert" className="text-xs text-destructive">
              {errors.body}
            </p>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted-foreground">{values.body.length}/2000</span>
        </div>
      </label>

      <div className="mt-5 flex flex-col-reverse justify-end gap-2 sm:flex-row">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
          {t('feedbackSnippets.cancel')}
        </Button>
        <Button type="submit" data-testid="feedback-snippet-submit" loading={isPending}>
          {snippet ? t('feedbackSnippets.save') : t('feedbackSnippets.create')}
        </Button>
      </div>
    </form>
  );
}

export { FeedbackSnippetForm };
export type { FeedbackSnippetFormValues };
