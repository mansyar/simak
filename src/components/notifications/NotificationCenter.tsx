import React from 'react';
import { X, CheckSquare, Loader2 } from 'lucide-react';
import { useI18n } from '@/routes/__root';
import { useNotificationsList, useMarkAllRead } from '@/hooks/use-notifications';
import { NotificationItem, type Notification } from './NotificationItem';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const GROUP_CONFIGS = [
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
    types: ['sla_breach'],
  },
];

export function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const { t } = useI18n();
  const { data, isLoading } = useNotificationsList({ page: 1, limit: 50 });
  const { mutate: markAllRead, isPending: isMarkingAll } = useMarkAllRead();

  if (!isOpen) return null;

  const items: Notification[] = data?.items || [];

  // Group notifications
  const groupedNotifications = GROUP_CONFIGS.map((group) => {
    const groupItems = items.filter((item) => group.types.includes(item.type));
    return {
      ...group,
      items: groupItems,
    };
  }).filter((group) => group.items.length > 0);

  const hasNotifications = items.length > 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-background border-l border-border shadow-2xl transition-all duration-300 ease-in-out">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">{t('notifications.title')}</h2>
            {items.filter((i) => !i.read).length > 0 && (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-400">
                {items.filter((i) => !i.read).length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
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
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              aria-label={t('notifications.closePanel')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
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
                    <span>{t(group.labelKey)}</span>
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
            </div>
          )}
        </div>
      </div>
    </>
  );
}
