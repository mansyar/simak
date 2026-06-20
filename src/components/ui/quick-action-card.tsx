import { Link } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface QuickActionCardProps {
  icon: LucideIcon;
  label: string;
  description: string;
  to: string;
  className?: string;
}

function QuickActionCard({ icon: Icon, label, description, to, className }: QuickActionCardProps) {
  return (
    <Link
      to={to as never}
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-md',
        className,
      )}
    >
      <div className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
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
