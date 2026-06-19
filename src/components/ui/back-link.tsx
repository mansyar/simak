import { Link, type LinkProps } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BackLinkProps {
  to: LinkProps['to'];
  label: string;
  search?: LinkProps['search'];
  className?: string;
}

function BackLink({ to, label, search, className }: BackLinkProps) {
  return (
    <Link
      to={to}
      search={search}
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors',
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Link>
  );
}

export { BackLink };
