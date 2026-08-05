import React, { useCallback } from 'react';
import { Link } from '@tanstack/react-router';
import {
  FileUp,
  CheckCircle,
  RefreshCw,
  ClipboardCheck,
  AlertTriangle,
  Bell,
  MessageCircle,
} from 'lucide-react';
import { useMarkRead } from '@/hooks/use-notifications';
import { getNotificationRoute } from './notification-routes';
import { useI18n } from '@/routes/__root';
import { formatRelativeTime } from '@/lib/format';

export interface Notification {
  id: number;
  userId: string;
  type: string;
  title: string;
  message: string | null;
  read: boolean | null;
  channel: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date | string | null;
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  submission_received: FileUp,
  review_completed: CheckCircle,
  revision_requested: RefreshCw,
  consultation_verified: ClipboardCheck,
  discussion_reply: MessageCircle,
  sla_breach: AlertTriangle,
};

function NotificationItemComponent({ item }: { item: Notification }) {
  const { locale, t } = useI18n();
  const { mutate: markAsRead } = useMarkRead();

  const IconComponent = TYPE_ICONS[item.type] || Bell;

  const getRelativeTime = (dateInput: Date | string | null | undefined) => {
    if (!dateInput) return t('notifications.justNow');
    try {
      const relativeTime = formatRelativeTime(dateInput, locale);
      return relativeTime === 'Invalid Date' ? t('notifications.justNow') : relativeTime;
    } catch {
      return t('notifications.justNow');
    }
  };

  const relativeTimeStr = getRelativeTime(item.createdAt);

  const handleClick = useCallback(() => {
    if (!item.read) {
      markAsRead(item.id);
    }
  }, [item.read, item.id, markAsRead]);

  const route = getNotificationRoute(item.type, item.metadata);

  const className = `group flex min-h-11 w-full items-start gap-3 border-b border-border/40 p-4 text-left transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${
    !item.read ? 'bg-blue-50/50 dark:bg-blue-950/20 font-medium' : 'hover:bg-accent/30'
  }`;

  const content = (
    <>
      <div
        className={`rounded-lg p-2 transition-transform duration-200 group-hover:scale-105 ${
          !item.read
            ? 'bg-blue-100/80 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        <IconComponent className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p
            className={`text-sm truncate ${
              !item.read ? 'text-foreground font-semibold' : 'text-muted-foreground'
            }`}
          >
            {item.title}
          </p>
          <span className="text-[10px] text-muted-foreground shrink-0">{relativeTimeStr}</span>
        </div>
        {item.message && (
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {item.message}
          </p>
        )}
        <span className="sr-only">
          {item.read ? t('notifications.read') : t('notifications.unread')}
        </span>
      </div>

      {!item.read && (
        <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
      )}
    </>
  );

  if (route) {
    return (
      <Link to={route} onClick={handleClick} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={handleClick} className={className}>
      {content}
    </button>
  );
}

export const NotificationItem = React.memo(NotificationItemComponent);
