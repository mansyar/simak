import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  children?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed bg-card p-8 text-center shadow-sm',
        'py-12',
        className,
      )}
    >
      <div className="mb-5 flex size-16 items-center justify-center rounded-full border border-dashed">
        <Icon className="size-7 text-muted-foreground" />
      </div>
      <h3 className="text-[0.9375rem] font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-[0.8125rem] text-muted-foreground">{description}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
