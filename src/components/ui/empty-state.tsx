import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed bg-card text-center shadow-sm',
        compact ? 'p-4 py-6' : 'p-8 py-12',
        className,
      )}
    >
      <div
        className={cn(
          'mb-5 flex items-center justify-center rounded-full border border-dashed',
          compact ? 'size-12' : 'size-16',
        )}
      >
        <Icon
          className={cn('text-muted-foreground', compact ? 'size-5' : 'size-7')}
          aria-hidden="true"
        />
      </div>
      <h3 className="text-[0.9375rem] font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 text-[0.8125rem] text-muted-foreground">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
