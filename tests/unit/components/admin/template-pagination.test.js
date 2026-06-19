import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TemplatePagination } from '@/components/admin/templates/TemplatePagination';
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key) => {
      const translations = {
        'common.next': 'Next',
        'common.back': 'Back',
        'common.page': 'Page',
      };
      return translations[key] || key;
    },
  }),
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }) =>
    _jsx('button', {
      onClick: onClick,
      disabled: disabled,
      'data-testid': 'pagination-btn',
      ...props,
      children: children,
    }),
}));
describe('TemplatePagination', () => {
  const onPageChange = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('should render page indicator showing current page', () => {
    render(_jsx(TemplatePagination, { currentPage: 1, totalPages: 5, onPageChange: onPageChange }));
    expect(
      screen.getByText(
        (content) => content.includes('Page') && content.includes('1') && content.includes('5'),
      ),
    ).toBeDefined();
  });
  it('should disable previous button on first page', () => {
    render(_jsx(TemplatePagination, { currentPage: 1, totalPages: 5, onPageChange: onPageChange }));
    const buttons = screen.getAllByTestId('pagination-btn');
    const prevButton = buttons[0];
    expect(prevButton.disabled).toBe(true);
  });
  it('should disable next button on last page', () => {
    render(_jsx(TemplatePagination, { currentPage: 5, totalPages: 5, onPageChange: onPageChange }));
    const buttons = screen.getAllByTestId('pagination-btn');
    const nextButton = buttons[buttons.length - 1];
    expect(nextButton.disabled).toBe(true);
  });
  it('should call onPageChange with prev page when previous clicked', () => {
    render(_jsx(TemplatePagination, { currentPage: 3, totalPages: 5, onPageChange: onPageChange }));
    const buttons = screen.getAllByTestId('pagination-btn');
    const prevButton = buttons[0];
    fireEvent.click(prevButton);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
  it('should call onPageChange with next page when next clicked', () => {
    render(_jsx(TemplatePagination, { currentPage: 3, totalPages: 5, onPageChange: onPageChange }));
    const buttons = screen.getAllByTestId('pagination-btn');
    const nextButton = buttons[buttons.length - 1];
    fireEvent.click(nextButton);
    expect(onPageChange).toHaveBeenCalledWith(4);
  });
  it('should render correctly with single page', () => {
    render(_jsx(TemplatePagination, { currentPage: 1, totalPages: 1, onPageChange: onPageChange }));
    expect(
      screen.getByText(
        (content) => content.includes('Page') && content.includes('1') && content.includes('1'),
      ),
    ).toBeDefined();
    const buttons = screen.getAllByTestId('pagination-btn');
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[buttons.length - 1].disabled).toBe(true);
  });
});
