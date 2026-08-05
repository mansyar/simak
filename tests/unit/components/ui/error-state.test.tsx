import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ErrorState } from '@/components/ui/error-state';

describe('ErrorState', () => {
  it('announces the failure and provides a retry action', () => {
    const onRetry = vi.fn();

    render(
      <ErrorState
        title="Unable to load assignments"
        description="Please try again."
        retryLabel="Try again"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('Unable to load assignments')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('does not expose a retry control when no retry handler is provided', () => {
    render(<ErrorState title="Unable to load" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
