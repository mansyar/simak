import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('should render student name', () => {
    render(
      <ReviewDetailHeader
        studentName="Alice"
        assignmentTitle="Thesis"
        checkpointName="Chapter 1"
      />,
    );
    expect(screen.getByText('Alice')).toBeDefined();
  });

  it('should render assignment title', () => {
    render(
      <ReviewDetailHeader
        studentName="Alice"
        assignmentTitle="Thesis"
        checkpointName="Chapter 1"
      />,
    );
    expect(screen.getByText('Thesis')).toBeDefined();
  });

  it('should render checkpoint name', () => {
    render(
      <ReviewDetailHeader
        studentName="Alice"
        assignmentTitle="Thesis"
        checkpointName="Chapter 1"
      />,
    );
    expect(screen.getByText('Chapter 1')).toBeDefined();
  });
});
