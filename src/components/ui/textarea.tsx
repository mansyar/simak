import * as React from 'react';

import { cn } from '@/lib/utils';

type TextareaProps = React.ComponentProps<'textarea'> & {
  size?: 'default' | 'sm';
};

function Textarea({ className, size = 'default', ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex w-full min-h-[80px] rounded-lg border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
        size === 'sm' && 'min-h-[60px] text-sm px-2.5 py-1.5',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
