import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface AlertBannerProps {
  variant: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

const variantStyles = {
  success: 'bg-success/10 text-success border-success/20',
  error: 'bg-destructive/10 text-destructive border-destructive/20',
  info: 'bg-info/10 text-info border-info/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
} as const;

function AlertBanner({ variant, title, description, children, className }: AlertBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-md border p-3 text-sm',
        variantStyles[variant],
        className,
      )}
    >
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 opacity-90">{description}</p>}
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}

export { AlertBanner };
