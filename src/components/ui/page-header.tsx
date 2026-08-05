import type { ReactNode } from 'react';
import type { LinkProps } from '@tanstack/react-router';
import { BackLink } from '@/components/ui/back-link';
import { cn } from '@/lib/utils';

interface PageHeaderBack {
  to: LinkProps['to'];
  label: string;
  search?: LinkProps['search'];
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  back?: PageHeaderBack;
  className?: string;
}

function PageHeader({ title, subtitle, action, back, className }: PageHeaderProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {back && <BackLink to={back.to} label={back.label} search={back.search} />}

      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="break-words font-display text-3xl text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>

        {action && <div className="w-full min-w-0 sm:w-auto">{action}</div>}
      </div>
    </div>
  );
}

export { PageHeader };
