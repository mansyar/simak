import { cn } from '@/lib/utils';

const colorVariants = {
  primary: {
    border: 'border-t-primary',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
  },
  success: {
    border: 'border-t-success',
    iconBg: 'bg-success/10',
    iconColor: 'text-success',
  },
  warning: {
    border: 'border-t-warning',
    iconBg: 'bg-warning/10',
    iconColor: 'text-warning',
  },
  error: {
    border: 'border-t-error',
    iconBg: 'bg-error/10',
    iconColor: 'text-error',
  },
  info: {
    border: 'border-t-info',
    iconBg: 'bg-info/10',
    iconColor: 'text-info',
  },
};

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color?: keyof typeof colorVariants;
  className?: string;
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  color = 'primary',
  className,
}: MetricCardProps) {
  const colors = colorVariants[color];

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border bg-card p-6 transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-md',
        'border-t-[3px]',
        colors.border,
        className,
      )}
    >
      <div
        className={cn(
          'mb-4 flex size-11 items-center justify-center rounded-md',
          colors.iconBg,
          colors.iconColor,
        )}
      >
        <Icon className="size-[22px]" aria-hidden="true" />
      </div>
      <div className="font-display text-[2.25rem] font-bold leading-none text-foreground">
        {value}
      </div>
      <p className="mt-1 text-[0.8125rem] text-muted-foreground">{label}</p>
    </div>
  );
}
