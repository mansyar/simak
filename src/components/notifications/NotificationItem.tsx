import React from 'react';
import { FileUp, CheckCircle, RefreshCw, ClipboardCheck, AlertTriangle, Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useMarkRead } from '@/hooks/use-notifications';

export interface Notification {
  id: number;
  userId: string;
  type: string;
  title: string;
  message: string | null;
  read: boolean | null;
  channel: string;
  createdAt: Date | string | null;
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  submission_received: FileUp,
  review_completed: CheckCircle,
  revision_requested: RefreshCw,
  consultation_verified: ClipboardCheck,
  sla_breach: AlertTriangle,
};

export function NotificationItem({ item }: { item: Notification }) {
  const { mutate: markAsRead } = useMarkRead();

  const IconComponent = TYPE_ICONS[item.type] || Bell;

  const getRelativeTime = (dateInput: Date | string | null | undefined) => {
    if (!dateInput) return '';
    try {
      const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return '';
    }
  };

  const relativeTimeStr = getRelativeTime(item.createdAt) || 'just now';

  const handleClick = () => {
    if (!item.read) {
      markAsRead(item.id);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`group flex items-start gap-3 border-b border-border/40 p-4 transition-all duration-200 cursor-pointer ${
        !item.read ? 'bg-blue-50/50 dark:bg-blue-950/20 font-medium' : 'hover:bg-accent/30'
      }`}
    >
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
      </div>

      {!item.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 shrink-0" />}
    </div>
  );
}
