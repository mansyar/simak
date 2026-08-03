import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { EmailQueueFilters } from '@/components/admin/email-queue/EmailQueueFilters';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) =>
      ({
        'adminEmailQueue.searchPlaceholder': 'Search email queue...',
        'adminEmailQueue.statusAll': 'All statuses',
        'adminEmailQueue.statusPending': 'Pending',
        'adminEmailQueue.statusProcessing': 'Processing',
        'adminEmailQueue.statusSent': 'Sent',
        'adminEmailQueue.statusFailed': 'Failed',
        'common.clearSearch': 'Clear search',
      })[key] ?? key,
  }),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input data-testid="search-input" {...props} />
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }: any) => (
    <select
      data-testid="status-select"
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => <span />,
}));

describe('EmailQueueFilters', () => {
  const onSearchChange = vi.fn();
  const onStatusChange = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderFilters(search = '') {
    return render(
      <EmailQueueFilters
        search={search}
        onSearchChange={onSearchChange}
        status="all"
        onStatusChange={onStatusChange}
      />,
    );
  }

  it('updates the visible value immediately and commits search after 300ms', () => {
    renderFilters();
    const input = screen.getByTestId('search-input') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'failed' } });

    expect(input.value).toBe('failed');
    expect(onSearchChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onSearchChange).toHaveBeenCalledTimes(1);
    expect(onSearchChange).toHaveBeenCalledWith('failed');
  });

  it('synchronizes route search and clears immediately', () => {
    const { rerender } = renderFilters('old');
    const input = screen.getByTestId('search-input') as HTMLInputElement;

    rerender(
      <EmailQueueFilters
        search="from-route"
        onSearchChange={onSearchChange}
        status="all"
        onStatusChange={onStatusChange}
      />,
    );
    expect(input.value).toBe('from-route');

    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(input.value).toBe('');
    expect(onSearchChange).toHaveBeenCalledWith('');
  });
});
