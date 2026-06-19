/** @vitest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Pagination } from '@/components/ui/pagination';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'common.pageOf': `Page ${params?.current} of ${params?.total}`,
        'common.previousPage': 'Previous page',
        'common.nextPage': 'Next page',
        'common.back': 'Back',
        'common.next': 'Next',
      };
      return translations[key] ?? key;
    },
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));

describe('Pagination', () => {
  it('should render current/total label', () => {
    render(<Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByText('Page 2 of 5')).toBeDefined();
  });

  it('should have aria-labels on prev/next buttons', () => {
    render(<Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /next page/i })).toBeDefined();
  });

  it('should disable prev button on first page', () => {
    render(<Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />);
    const prevButton = screen.getByRole('button', { name: /previous page/i });
    expect(prevButton).toHaveProperty('disabled', true);
  });

  it('should disable next button on last page', () => {
    render(<Pagination currentPage={5} totalPages={5} onPageChange={vi.fn()} />);
    const nextButton = screen.getByRole('button', { name: /next page/i });
    expect(nextButton).toHaveProperty('disabled', true);
  });

  it('should fire onPageChange with correct page on prev click', () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={3} totalPages={5} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole('button', { name: /previous page/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('should fire onPageChange with correct page on next click', () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={3} totalPages={5} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole('button', { name: /next page/i }));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });
});
