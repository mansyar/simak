import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ReviewDetailHeader } from '@/components/reviews/ReviewDetailHeader';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

describe('ReviewDetailHeader', () => {
  it('should render back button', () => {
    render(
      <ReviewDetailHeader
        studentName="Alice"
        assignmentTitle="Thesis"
        checkpointName="Chapter 1"
      />,
    );
    expect(screen.getByText('common.back')).toBeDefined();
  });

  it('should render student name as heading', () => {
    render(
      <ReviewDetailHeader
        studentName="Alice"
        assignmentTitle="Thesis"
        checkpointName="Chapter 1"
      />,
    );
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Alice');
  });

  it('should render assignment title and checkpoint name in subtitle', () => {
    render(
      <ReviewDetailHeader
        studentName="Alice"
        assignmentTitle="Thesis"
        checkpointName="Chapter 1"
      />,
    );
    expect(screen.getByText(/Thesis/)).toBeDefined();
    expect(screen.getByText(/Chapter 1/)).toBeDefined();
  });

  it('should render canonical heading classes', () => {
    render(
      <ReviewDetailHeader
        studentName="Alice"
        assignmentTitle="Thesis"
        checkpointName="Chapter 1"
      />,
    );
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveClass('font-display', 'text-3xl', 'text-foreground');
  });
});
