import React, { useState, useMemo } from 'react';
import { Bell, CheckSquare, Loader2 } from 'lucide-react';
import { useI18n } from '@/routes/__root';
import type { TranslationKey } from '@/i18n/index';
import { useNotificationsList, useMarkAllRead } from '@/hooks/use-notifications';
import { NotificationItem, type Notification } from './NotificationItem';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs } from '@/components/ui/tabs';
import { ErrorState } from '@/components/ui/error-state';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GROUP_CONFIGS = [
  {
    key: 'newReviews',
    labelKey: 'notifications.groups.newReviews',
    types: ['review_completed', 'revision_requested'],
  },
  {
    key: 'consultations',
    labelKey: 'notifications.groups.consultations',
    types: [
      'consultation_verified',
      'consultation_logged',
      'consultation_rejected',
      'discussion_reply',
    ],
  },
  {
    key: 'submissions',
    labelKey: 'notifications.groups.submissions',
    types: ['submission_received'],
  },
  {
    key: 'system',
    labelKey: 'notifications.groups.system',
    types: ['sla_breach', 'student_at_risk'],
  },
];

export function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const {
    data,
    isLoading,
    isError,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = useNotificationsList({
    limit: 20,
    unreadOnly: activeTab === 'unread',
  });
  const { mutate: markAllRead, isPending: isMarkingAll } = useMarkAllRead();

  const items = (data?.pages.flatMap((p) => p.items) ?? []) as Notification[];
  const hasNotifications = items.length > 0;

  // Group notifications (memoized — PERF-27)
  const groupedNotifications = useMemo(() => {
    const groups = GROUP_CONFIGS.map((group) => {
      const groupItems = items.filter((item) => group.types.includes(item.type));
      return {
        ...group,
        items: groupItems,
      };
    }).filter((group) => group.items.length > 0);
    const knownTypes = new Set(GROUP_CONFIGS.flatMap((group) => group.types));
    const otherItems = items.filter((item) => !knownTypes.has(item.type));

    if (otherItems.length > 0) {
      groups.push({
        key: 'other',
        labelKey: 'notifications.groups.other',
        types: [],
        items: otherItems,
      });
    }

    return groups;
  }, [items]);

  const unreadCount = useMemo(() => items.filter((i) => !i.read).length, [items]);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full max-w-md gap-0">
        <SheetHeader className="flex-row items-center justify-between border-b border-border pr-10">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-lg font-semibold">{t('notifications.title')}</SheetTitle>
            {unreadCount > 0 && (
              <span
                data-testid="unread-count"
                aria-label={t('notifications.unreadCount', { count: String(unreadCount) })}
                className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-400"
              >
                {unreadCount}
              </span>
            )}
          </div>
          {hasNotifications && (
            <button
              type="button"
              onClick={() => markAllRead()}
              disabled={isMarkingAll || items.every((i) => i.read)}
              aria-busy={isMarkingAll}
              className="inline-flex min-h-11 min-w-11 items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              {t('notifications.markAllRead')}
            </button>
          )}
        </SheetHeader>

        {/* Read/Unread filter tabs (FR-3) */}
        <div className="px-4 pt-2">
          <Tabs
            tabs={[
              { id: 'all', label: t('notifications.filterAll') },
              { id: 'unread', label: t('notifications.filterUnread') },
            ]}
            activeTab={activeTab}
            idPrefix="notifications"
            ariaLabel={t('notifications.filterLabel')}
            onTabChange={(tabId) => {
              setActiveTab(tabId as 'all' | 'unread');
            }}
          />
        </div>

        {/* Content area */}
        <div
          id={`notifications-tabpanel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`notifications-tab-${activeTab}`}
          tabIndex={0}
          className="min-h-0 flex-1 overflow-y-auto"
        >
          {isLoading ? (
            <div
              role="status"
              aria-live="polite"
              aria-busy="true"
              className="flex h-64 items-center justify-center"
            >
              <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="sr-only">{t('notifications.loading')}</span>
            </div>
          ) : isError ? (
            <ErrorState
              className="m-4"
              title={t('errors.fetchFailed')}
              retryLabel={t('common.refresh')}
              onRetry={() => void (refetch as unknown as () => unknown)()}
            />
          ) : !hasNotifications ? (
            <div className="flex h-64 flex-col items-center justify-center p-6 text-center">
              <div className="rounded-full bg-muted p-3 text-muted-foreground">
                <Bell aria-hidden="true" className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">
                {t('notifications.empty')}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('notifications.emptyDescription')}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              {groupedNotifications.map((group) => (
                <div key={group.key} className="py-2">
                  <div className="px-4 py-2 bg-muted/30 text-xs font-semibold text-muted-foreground flex items-center justify-between">
                    <span>{t(group.labelKey as TranslationKey)}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                      {group.items.length}
                    </span>
                  </div>
                  <div>
                    {group.items.map((item) => (
                      <NotificationItem key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              ))}
              {isFetchNextPageError ? (
                <ErrorState
                  className="m-4"
                  title={t('errors.fetchFailed')}
                  retryLabel={t('common.refresh')}
                  onRetry={() => void (refetch as unknown as () => unknown)()}
                />
              ) : hasNextPage ? (
                <div className="p-4">
                  <button
                    type="button"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    aria-busy={isFetchingNextPage}
                    className="min-h-11 w-full rounded border border-border py-2 text-sm font-medium text-primary transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
                  >
                    {isFetchingNextPage ? (
                      <span
                        role="status"
                        aria-live="polite"
                        className="inline-flex items-center gap-2"
                      >
                        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                        {t('notifications.loadingMore')}
                      </span>
                    ) : (
                      t('notifications.loadMore')
                    )}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
