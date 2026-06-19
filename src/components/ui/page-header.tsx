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

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>

        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
}

export { PageHeader };
