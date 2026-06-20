import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface ListRowProps {
  left: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  className?: string;
}

function ListRow({ left, right, onClick, className }: ListRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-md border p-3 text-sm',
        onClick && 'cursor-pointer hover:bg-accent transition-colors',
        className,
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div>{left}</div>
      {right && <div>{right}</div>}
    </div>
  );
}

export { ListRow };
