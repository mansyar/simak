import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { FileUp, CheckCircle, RefreshCw, ClipboardCheck, AlertTriangle, Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { useMarkRead } from '@/hooks/use-notifications';
const TYPE_ICONS = {
  submission_received: FileUp,
  review_completed: CheckCircle,
  revision_requested: RefreshCw,
  consultation_verified: ClipboardCheck,
  sla_breach: AlertTriangle,
};
export function NotificationItem({ item }) {
  const { mutate: markAsRead } = useMarkRead();
  const IconComponent = TYPE_ICONS[item.type] || Bell;
  const getRelativeTime = (dateInput) => {
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
  return _jsxs('div', {
    onClick: handleClick,
    className: `group flex items-start gap-3 border-b border-border/40 p-4 transition-all duration-200 cursor-pointer ${!item.read ? 'bg-blue-50/50 dark:bg-blue-950/20 font-medium' : 'hover:bg-accent/30'}`,
    children: [
      _jsx('div', {
        className: `rounded-lg p-2 transition-transform duration-200 group-hover:scale-105 ${
          !item.read
            ? 'bg-blue-100/80 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
            : 'bg-muted text-muted-foreground'
        }`,
        children: _jsx(IconComponent, { className: 'h-4 w-4' }),
      }),
      _jsxs('div', {
        className: 'flex-1 min-w-0',
        children: [
          _jsxs('div', {
            className: 'flex items-center justify-between gap-2',
            children: [
              _jsx('p', {
                className: `text-sm truncate ${!item.read ? 'text-foreground font-semibold' : 'text-muted-foreground'}`,
                children: item.title,
              }),
              _jsx('span', {
                className: 'text-[10px] text-muted-foreground shrink-0',
                children: relativeTimeStr,
              }),
            ],
          }),
          item.message &&
            _jsx('p', {
              className: 'mt-0.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed',
              children: item.message,
            }),
        ],
      }),
      !item.read && _jsx('span', { className: 'mt-1.5 h-2 w-2 rounded-full bg-blue-500 shrink-0' }),
    ],
  });
}
