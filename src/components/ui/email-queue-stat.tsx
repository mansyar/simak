import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface EmailQueueStatProps {
  icon: LucideIcon;
  color: 'primary' | 'success' | 'error';
  label: string;
  value: number;
  className?: string;
}

const colorStyles = {
  primary: {
    iconBg: 'bg-primary/10 text-primary',
    label: 'text-primary',
  },
  success: {
    iconBg: 'bg-success/10 text-success',
    label: 'text-success',
  },
  error: {
    iconBg: 'bg-error/10 text-error',
    label: 'text-error',
  },
} as const;

function EmailQueueStat({ icon: Icon, color, label, value, className }: EmailQueueStatProps) {
  const colors = colorStyles[color];

  return (
    <div className={cn('rounded-lg bg-card p-5 text-center', className)}>
      <div
        className={cn(
          'mx-auto mb-3 flex size-10 items-center justify-center rounded-full',
          colors.iconBg,
        )}
      >
        <Icon className="size-5" />
      </div>
      <div className="font-display text-[1.75rem] font-bold leading-none text-foreground">
        {value}
      </div>
      <p className={cn('mt-1 text-[0.8125rem] font-medium', colors.label)}>{label}</p>
    </div>
  );
}

export { EmailQueueStat };
