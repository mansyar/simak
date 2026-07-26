import * as React from 'react';
import { cn } from '@/lib/utils';

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  maxHeight?: string;
}

export function ScrollArea({ className, maxHeight, children, ...props }: ScrollAreaProps) {
  return (
    <div
      data-slot="scroll-area"
      className={cn('overflow-y-auto', className)}
      style={maxHeight ? { maxHeight } : undefined}
      {...props}
    >
      {children}
    </div>
  );
}
