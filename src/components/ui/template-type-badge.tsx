import { cn } from '@/lib/utils';

interface TemplateTypeBadgeProps {
  type: string;
  className?: string;
}

function TemplateTypeBadge({ type, className }: TemplateTypeBadgeProps) {
  return (
    <span
      className={cn(
        'text-[10px] font-bold tracking-wider uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-full',
        className,
      )}
    >
      {type}
    </span>
  );
}

export { TemplateTypeBadge };
