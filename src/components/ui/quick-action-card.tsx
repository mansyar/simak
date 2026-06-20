import { Link } from '@tanstack/react-router';
import { cn } from '@/lib/utils';

interface QuickActionCardProps {
  to: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color?: 'primary' | 'success' | 'warning' | 'destructive';
  className?: string;
}

const colorClasses = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
} as const;

function QuickActionCard({
  to,
  label,
  description,
  icon: Icon,
  color = 'primary',
  className,
}: QuickActionCardProps) {
  return (
    <Link
      to={to as never}
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-md',
        className,
      )}
    >
      <div
        className={cn(
          'flex size-9 items-center justify-center rounded-md',
          colorClasses[color],
        )}
      >
        <Icon className="size-[18px]" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}

export { QuickActionCard };
