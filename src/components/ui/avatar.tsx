import * as React from 'react';
import { cn } from '@/lib/utils';

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  src?: string;
  size?: 'sm' | 'default' | 'lg';
}

function getInitials(name: string): string {
  if (!name.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

const sizeClasses = {
  sm: 'size-8 text-xs',
  default: 'size-10 text-sm',
  lg: 'size-12 text-base',
};

export function Avatar({ name, src, size = 'default', className, ...props }: AvatarProps) {
  return (
    <div
      data-slot="avatar"
      {...(src ? {} : { role: 'img', 'aria-label': name })}
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground font-medium',
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {src ? (
        <img src={src} alt={name} className="size-full object-cover" />
      ) : (
        <span aria-hidden="true">{getInitials(name)}</span>
      )}
    </div>
  );
}
