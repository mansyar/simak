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
  it('should render prev/next buttons only by default (no counter, no page numbers)', () => {
    render(<Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /next page/i })).toBeDefined();
    // Counter should NOT be visible by default
    expect(screen.queryByText('Page 2 of 5')).toBeNull();
  });

  it('should render current/total label when showCounter is true', () => {
    render(<Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} showCounter />);
    expect(screen.getByText('Page 2 of 5')).toBeDefined();
  });

  it('should render custom counter text with labelFormatter', () => {
    const formatter = (current: number, total: number) => `Showing page ${current} of ${total}`;
    render(
      <Pagination
        currentPage={3}
        totalPages={10}
        onPageChange={vi.fn()}
        showCounter
        labelFormatter={formatter}
      />,
    );
    expect(screen.getByText('Showing page 3 of 10')).toBeDefined();
  });

  it('should render page numbers when showPageNumbers is true (up to 5)', () => {
    render(<Pagination currentPage={3} totalPages={10} onPageChange={vi.fn()} showPageNumbers />);
    // Should show 5 page number buttons: 1, 2, 3, 4, 5
    const pageButtons = screen
      .getAllByRole('button')
      .filter((btn) => !btn.getAttribute('aria-label')?.match(/(previous|next) page/i));
    expect(pageButtons).toHaveLength(5);
    expect(pageButtons.map((b) => b.textContent)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('should clamp page numbers at the start', () => {
    render(<Pagination currentPage={1} totalPages={10} onPageChange={vi.fn()} showPageNumbers />);
    const pageButtons = screen
      .getAllByRole('button')
      .filter((btn) => !btn.getAttribute('aria-label')?.match(/(previous|next) page/i));
    expect(pageButtons).toHaveLength(5);
    expect(pageButtons.map((b) => b.textContent)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('should clamp page numbers at the end', () => {
    render(<Pagination currentPage={10} totalPages={10} onPageChange={vi.fn()} showPageNumbers />);
    const pageButtons = screen
      .getAllByRole('button')
      .filter((btn) => !btn.getAttribute('aria-label')?.match(/(previous|next) page/i));
    expect(pageButtons).toHaveLength(5);
    expect(pageButtons.map((b) => b.textContent)).toEqual(['6', '7', '8', '9', '10']);
  });

  it('should fire onPageChange when a page number is clicked', () => {
    const onPageChange = vi.fn();
    render(
      <Pagination currentPage={3} totalPages={10} onPageChange={onPageChange} showPageNumbers />,
    );
    const page5 = screen.getAllByRole('button').find((btn) => btn.textContent === '5');
    fireEvent.click(page5!);
    expect(onPageChange).toHaveBeenCalledWith(5);
  });

  it('should highlight the current page number', () => {
    render(<Pagination currentPage={3} totalPages={10} onPageChange={vi.fn()} showPageNumbers />);
    const page3 = screen.getAllByRole('button').find((btn) => btn.textContent === '3');
    expect(page3?.getAttribute('aria-current')).toBe('page');
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
