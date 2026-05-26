import React from 'react';
import { Bell, BellDot } from 'lucide-react';
import { useUnreadCount } from '@/hooks/use-notifications';

export function NotificationBadge({ onOpen }: { onOpen: () => void }) {
  const { data: count = 0, isSuccess } = useUnreadCount();

  const hasUnread = isSuccess && count > 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      aria-label="View notifications"
    >
      {hasUnread ? (
        <>
          <BellDot className="h-5 w-5 text-red-500" />
          <span
            role="status"
            className="absolute top-1 right-1 inline-flex items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4"
          >
            {count}
          </span>
        </>
      ) : (
        <Bell className="h-5 w-5" />
      )}
    </button>
  );
}
