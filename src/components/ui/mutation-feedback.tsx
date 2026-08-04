import { cn } from '@/lib/utils';

type MutationFeedbackProps = {
  error?: string;
  success?: string;
  className?: string;
};

export function MutationFeedback({ error, success, className }: MutationFeedbackProps) {
  const message = error || success;

  if (!message) return null;

  return (
    <div
      role={error ? 'alert' : 'status'}
      aria-live={error ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={cn(
        'rounded-md p-3 text-sm',
        error ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success',
        className,
      )}
    >
      {message}
    </div>
  );
}
