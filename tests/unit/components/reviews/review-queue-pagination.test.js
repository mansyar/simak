import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReviewQueuePagination } from '@/components/reviews/ReviewQueuePagination';
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key) => key,
  }),
}));
describe('ReviewQueuePagination', () => {
  it('should render page indicator', () => {
    render(_jsx(ReviewQueuePagination, { currentPage: 1, totalPages: 5, onPageChange: () => {} }));
    expect(screen.getByText(/page 1 of 5/i)).toBeDefined();
  });
  it('should disable prev button on first page', () => {
    render(_jsx(ReviewQueuePagination, { currentPage: 1, totalPages: 5, onPageChange: () => {} }));
    const buttons = screen.getAllByRole('button');
    const prevButton = buttons[0];
    expect(prevButton).toHaveProperty('disabled', true);
  });
  it('should disable next button on last page', () => {
    render(_jsx(ReviewQueuePagination, { currentPage: 5, totalPages: 5, onPageChange: () => {} }));
    const buttons = screen.getAllByRole('button');
    const nextButton = buttons[buttons.length - 1];
    expect(nextButton).toHaveProperty('disabled', true);
  });
  it('should call onPageChange with next page', () => {
    const onPageChange = vi.fn();
    render(
      _jsx(ReviewQueuePagination, { currentPage: 1, totalPages: 5, onPageChange: onPageChange }),
    );
    const buttons = screen.getAllByRole('button');
    const nextButton = buttons[buttons.length - 1];
    fireEvent.click(nextButton);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
  it('should call onPageChange with previous page', () => {
    const onPageChange = vi.fn();
    render(
      _jsx(ReviewQueuePagination, { currentPage: 3, totalPages: 5, onPageChange: onPageChange }),
    );
    const buttons = screen.getAllByRole('button');
    const prevButton = buttons[0];
    fireEvent.click(prevButton);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
  it('should show correct text for page with long label', () => {
    render(_jsx(ReviewQueuePagination, { currentPage: 2, totalPages: 3, onPageChange: () => {} }));
    expect(screen.getByText(/2 of 3/)).toBeDefined();
  });
});
