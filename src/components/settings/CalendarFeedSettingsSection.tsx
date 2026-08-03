import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/routes/__root';
import {
  enableCalendarFeed,
  getCalendarFeedStatus,
  regenerateCalendarFeed,
  revokeCalendarFeed,
} from '@/server/calendar-feed';
import { settingsKeys } from '@/lib/query-keys';

type FeedStatus = {
  enabled: boolean;
};

type FeedMutationResult = {
  enabled?: boolean;
  feedUrl?: string | null;
  error?: unknown;
};

type Feedback = 'copied' | 'copyError' | 'enabled' | 'regenerated' | 'revoked' | 'error' | null;

function isFeedError(value: unknown): value is { error: unknown } {
  return typeof value === 'object' && value !== null && 'error' in value;
}

export function CalendarFeedSettingsSection() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [localEnabled, setLocalEnabled] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: settingsKeys.calendarFeed(),
    queryFn: async () => (await getCalendarFeedStatus()) as FeedStatus,
  });

  const enableMutation = useMutation({
    mutationFn: (args: { data: Record<string, never> }) => enableCalendarFeed(args),
  });
  const regenerateMutation = useMutation({
    mutationFn: (args: { data: Record<string, never> }) => regenerateCalendarFeed(args),
  });
  const revokeMutation = useMutation({
    mutationFn: (args: { data: Record<string, never> }) => revokeCalendarFeed(args),
  });
  const isPending =
    enableMutation.isPending || regenerateMutation.isPending || revokeMutation.isPending;

  const refreshStatus = () =>
    queryClient.invalidateQueries({ queryKey: settingsKeys.calendarFeed() });

  const handleEnable = async () => {
    setFeedback(null);
    try {
      const result = (await enableMutation.mutateAsync({ data: {} })) as FeedMutationResult;
      if (isFeedError(result)) throw new Error('calendar-feed-error');
      setFeedUrl(result.feedUrl ?? null);
      setLocalEnabled(true);
      setFeedback('enabled');
      await refreshStatus();
    } catch {
      setFeedback('error');
    }
  };

  const handleRegenerate = async () => {
    if (!window.confirm(t('settings.calendarFeed.confirmRegenerate'))) return;

    setFeedback(null);
    try {
      const result = (await regenerateMutation.mutateAsync({ data: {} })) as FeedMutationResult;
      if (isFeedError(result)) throw new Error('calendar-feed-error');
      setFeedUrl(result.feedUrl ?? null);
      setLocalEnabled(true);
      setFeedback('regenerated');
      await refreshStatus();
    } catch {
      setFeedback('error');
    }
  };

  const handleRevoke = async () => {
    if (!window.confirm(t('settings.calendarFeed.confirmRevoke'))) return;

    setFeedback(null);
    try {
      const result = (await revokeMutation.mutateAsync({ data: {} })) as FeedMutationResult;
      if (isFeedError(result)) throw new Error('calendar-feed-error');
      setFeedUrl(null);
      setLocalEnabled(false);
      setFeedback('revoked');
      await refreshStatus();
    } catch {
      setFeedback('error');
    }
  };

  const handleCopy = async () => {
    if (!feedUrl) return;

    try {
      await navigator.clipboard.writeText(feedUrl);
      setFeedback('copied');
    } catch {
      setFeedback('copyError');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          {t('settings.calendarFeed.loading')}
        </CardContent>
      </Card>
    );
  }

  const enabled = localEnabled ?? data?.enabled === true;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" aria-hidden="true" />
          {t('settings.calendarFeed.title')}
        </CardTitle>
        <CardDescription>{t('settings.calendarFeed.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isError && (
          <p role="alert" className="text-sm text-destructive">
            {t('settings.calendarFeed.error')}
          </p>
        )}

        {!enabled && (
          <button
            type="button"
            onClick={handleEnable}
            disabled={isPending}
            className="min-h-10 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('settings.calendarFeed.enable')}
          </button>
        )}

        {enabled && (
          <div className="space-y-4">
            <p role="status" className="text-sm text-muted-foreground">
              {t('settings.calendarFeed.enabled')}
            </p>
            {feedUrl ? (
              <div className="space-y-2">
                <label htmlFor="student-calendar-feed-url" className="text-sm font-medium">
                  {t('settings.calendarFeed.urlLabel')}
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="student-calendar-feed-url"
                    type="url"
                    readOnly
                    value={feedUrl}
                    className="min-h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    disabled={isPending}
                    className="min-h-10 rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t('settings.calendarFeed.copy')}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('settings.calendarFeed.empty')}</p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={isPending}
                className="min-h-10 rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('settings.calendarFeed.regenerate')}
              </button>
              <button
                type="button"
                onClick={handleRevoke}
                disabled={isPending}
                className="min-h-10 rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('settings.calendarFeed.revoke')}
              </button>
            </div>
          </div>
        )}

        {feedback === 'copied' && (
          <p role="status" className="text-sm text-green-600">
            {t('settings.calendarFeed.copied')}
          </p>
        )}
        {feedback === 'enabled' && (
          <p role="status" className="text-sm text-green-600">
            {t('settings.calendarFeed.enabled')}
          </p>
        )}
        {feedback === 'regenerated' && (
          <p role="status" className="text-sm text-green-600">
            {t('settings.calendarFeed.regenerated')}
          </p>
        )}
        {feedback === 'revoked' && (
          <p role="status" className="text-sm text-green-600">
            {t('settings.calendarFeed.revoked')}
          </p>
        )}
        {feedback === 'error' && (
          <p role="alert" className="text-sm text-destructive">
            {t('settings.calendarFeed.error')}
          </p>
        )}
        {feedback === 'copyError' && (
          <p role="alert" className="text-sm text-destructive">
            {t('settings.calendarFeed.copyError')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
