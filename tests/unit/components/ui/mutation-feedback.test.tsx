import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MutationFeedback } from '@/components/ui/mutation-feedback';

describe('MutationFeedback', () => {
  it('renders errors as an assertive alert', () => {
    render(<MutationFeedback error="Unable to save" />);

    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('Unable to save')).toBeDefined();
  });

  it('renders success messages as a polite status', () => {
    render(<MutationFeedback success="Saved" />);

    expect(screen.getByRole('status')).toBeDefined();
    expect(screen.getByText('Saved')).toBeDefined();
  });

  it('renders nothing without feedback', () => {
    const { container } = render(<MutationFeedback />);

    expect(container.firstChild).toBeNull();
  });
});
