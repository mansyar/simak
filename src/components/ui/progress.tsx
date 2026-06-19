import * as React from 'react';
import { cn } from '@/lib/utils';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Current progress value (0 to max). */
  value?: number;
  /** Maximum value. Defaults to 100. */
  max?: number;
  /** Optional label displayed above the bar. */
  label?: string;
  /** Whether to show the percentage text. Defaults to false. */
  showValue?: boolean;
}

function Progress({
  className,
  value = 0,
  max = 100,
  label,
  showValue = false,
  ...props
}: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemax={max}
      aria-valuemin={0}
      className={cn('w-full', className)}
      {...props}
    >
      {(label || showValue) && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          {label && <span className="text-muted-foreground">{label}</span>}
          {showValue && <span className="font-semibold text-foreground">{Math.round(percentage)}%</span>}
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export { Progress, type ProgressProps };
