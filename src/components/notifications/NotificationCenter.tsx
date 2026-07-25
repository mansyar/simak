import React, { useState, useEffect, useMemo } from 'react';
import { X, CheckSquare, Loader2 } from 'lucide-react';
import { useI18n } from '@/routes/__root';
import type { TranslationKey } from '@/i18n/index';
import { useNotificationsList, useMarkAllRead } from '@/hooks/use-notifications';
import { NotificationItem, type Notification } from './NotificationItem';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs } from '@/components/ui/tabs';

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
    types: ['consultation_verified', 'consultation_logged', 'consultation_rejected'],
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
  const [currentPage, setCurrentPage] = useState(1);
  const [allItems, setAllItems] = useState<Notification[]>([]);
  const { data, isLoading, isFetching } = useNotificationsList({
    page: currentPage,
    limit: 20,
    unreadOnly: activeTab === 'unread',
  });
  const { mutate: markAllRead, isPending: isMarkingAll } = useMarkAllRead();

  // Accumulate items across pages (FR-4 Load More pagination)
  useEffect(() => {
    if (!data?.items) return;
    if (currentPage === 1) {
      setAllItems(data.items as Notification[]);
    } else {
      setAllItems((prev) => {
        const existingIds = new Set(prev.map((i) => i.id));
        const newItems = (data.items as Notification[]).filter((i) => !existingIds.has(i.id));
        return [...prev, ...newItems];
      });
    }
  }, [data, currentPage]);

  const items: Notification[] = allItems;
  const total = data?.total ?? 0;
  const hasMore = items.length < total;

  // Group notifications (memoized — PERF-27)
  const groupedNotifications = useMemo(() => {
    return GROUP_CONFIGS.map((group) => {
      const groupItems = items.filter((item) => group.types.includes(item.type));
      return {
        ...group,
        items: groupItems,
      };
    }).filter((group) => group.items.length > 0);
  }, [items]);

  const hasNotifications = items.length > 0;
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
              className="inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-accent disabled:opacity-50 transition-colors"
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
            onTabChange={(tabId) => {
              setActiveTab(tabId as 'all' | 'unread');
              setCurrentPage(1);
            }}
          />
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && allItems.length === 0 ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !hasNotifications ? (
            <div className="flex h-64 flex-col items-center justify-center p-6 text-center">
              <div className="rounded-full bg-muted p-3 text-muted-foreground">
                <X className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">
                {t('notifications.empty')}
              </h3>
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
              {hasMore && (
                <div className="p-4">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => p + 1)}
                    disabled={isFetching}
                    className="w-full rounded border border-border py-2 text-sm font-medium text-primary hover:bg-accent disabled:opacity-50 transition-colors"
                  >
                    {isFetching ? (
                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    ) : (
                      t('notifications.loadMore')
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
