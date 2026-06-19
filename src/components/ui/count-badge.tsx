import { cn } from '@/lib/utils';

interface CountBadgeProps {
  count: number;
  hideWhenZero?: boolean;
  className?: string;
}

function CountBadge({ count, hideWhenZero = false, className }: CountBadgeProps) {
  if (hideWhenZero && count === 0) {
    return null;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-primary text-primary-foreground',
        className,
      )}
    >
      {count}
    </span>
  );
}

export { CountBadge };
