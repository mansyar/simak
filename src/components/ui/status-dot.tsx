import { cn } from '@/lib/utils';

type StatusDotVariant = 'verified' | 'inactive';

const variantStyles: Record<StatusDotVariant, { dot: string }> = {
  verified: {
    dot: 'bg-success',
  },
  inactive: {
    dot: 'bg-muted-foreground/40',
  },
};

interface StatusDotProps {
  variant: StatusDotVariant;
  label?: string;
  className?: string;
}

export function StatusDot({ variant, label, className }: StatusDotProps) {
  const styles = variantStyles[variant];

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className={cn('inline-block size-2 rounded-full', styles.dot)} />
      {label && <span className="text-sm text-foreground">{label}</span>}
    </span>
  );
}
