import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import * as hooks from '@/hooks/use-notifications';

// Mock the i18n context hook
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    locale: 'en',
    t: (key: string) => {
      if (key === 'notifications.title') return 'Notifications';
      if (key === 'notifications.markAllRead') return 'Mark all read';
      if (key === 'notifications.empty') return 'No notifications yet';
      if (key === 'notifications.filterAll') return 'All';
      if (key === 'notifications.filterUnread') return 'Unread';
      if (key === 'notifications.loadMore') return 'Load More';
      if (key === 'notifications.loadingMore') return 'Loading more notifications...';
      if (key === 'notifications.filterLabel') return 'Notification filter';
      if (key === 'notifications.emptyDescription') return "You're all caught up.";
      if (key === 'notifications.groups.newReviews') return 'New Reviews';
      if (key === 'notifications.groups.consultations') return 'Consultation Updates';
      if (key === 'notifications.groups.submissions') return 'Submissions';
      if (key === 'notifications.groups.system') return 'System Notifications';
      return key;
    },
  }),
}));

// Mock TanStack Router Link
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className, onClick, ...props }: any) => (
    <a href={to} className={className} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

// Mock the hooks
vi.mock('@/hooks/use-notifications', () => ({
  useUnreadCount: vi.fn(),
  useNotificationsList: vi.fn(),
  useMarkRead: vi.fn(),
  useMarkAllRead: vi.fn(),
}));

// Mock the Sheet component
vi.mock('@/components/ui/sheet', () => {
  const Sheet = ({ children, open }: any) => (open ? <div>{children}</div> : null);
  const SheetContent = ({ children, ...rest }: any) => <div {...rest}>{children}</div>;
  return {
    Sheet,
    SheetContent,
    SheetHeader: ({ children }: any) => <div>{children}</div>,
    SheetFooter: ({ children }: any) => <div>{children}</div>,
    SheetTitle: ({ children }: any) => <h2>{children}</h2>,
    SheetDescription: ({ children }: any) => <p>{children}</p>,
    SheetClose: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  };
});

describe('NotificationCenter - Load More Pagination (FR-4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const makeItem = (id: number) => ({
    id,
    type: 'review_completed',
    title: `Test ${id}`,
    message: 'msg',
    read: false,
    createdAt: new Date().toISOString(),
  });

  const setupMocks = (
    pages: Array<{ items: any[]; total: number }> = [],
    opts: { hasNextPage?: boolean; isFetchingNextPage?: boolean; isLoading?: boolean } = {},
  ) => {
    const fetchNextPage = vi.fn();
    vi.mocked(hooks.useNotificationsList).mockReturnValue({
      data: { pages, pageParams: pages.map((_, i) => i + 1) },
      isSuccess: true,
      isFetching: false,
      hasNextPage: opts.hasNextPage ?? false,
      isFetchingNextPage: opts.isFetchingNextPage ?? false,
      fetchNextPage,
      isLoading: opts.isLoading ?? false,
    } as any);
    vi.mocked(hooks.useMarkAllRead).mockReturnValue({
      mutate: vi.fn(),
    } as any);
    vi.mocked(hooks.useMarkRead).mockReturnValue({
      mutate: vi.fn(),
    } as any);
    return { fetchNextPage };
  };

  it('uses limit of 20 (not 50)', () => {
    setupMocks([{ items: [], total: 0 }]);
    render(<NotificationCenter isOpen={true} onClose={vi.fn()} />);
    expect(hooks.useNotificationsList).toHaveBeenCalledWith(expect.objectContaining({ limit: 20 }));
  });

  it('does not pass page to useNotificationsList', () => {
    setupMocks([{ items: [], total: 0 }]);
    render(<NotificationCenter isOpen={true} onClose={vi.fn()} />);
    const callArgs = vi.mocked(hooks.useNotificationsList).mock.calls[0][0] as any;
    expect(callArgs).not.toHaveProperty('page');
  });

  it('shows Load More button when hasNextPage is true', () => {
    setupMocks([{ items: [makeItem(1)], total: 10 }], { hasNextPage: true });
    render(<NotificationCenter isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Load More')).toBeDefined();
  });

  it('hides Load More button when hasNextPage is false', () => {
    setupMocks([{ items: [makeItem(1)], total: 1 }], { hasNextPage: false });
    render(<NotificationCenter isOpen={true} onClose={vi.fn()} />);
    expect(screen.queryByText('Load More')).toBeNull();
  });

  it('calls fetchNextPage when Load More is clicked', () => {
    const { fetchNextPage } = setupMocks([{ items: [makeItem(1)], total: 10 }], {
      hasNextPage: true,
    });
    render(<NotificationCenter isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Load More'));
    expect(fetchNextPage).toHaveBeenCalled();
  });

  it('announces loading more and keeps the control touch-safe', () => {
    setupMocks([{ items: [makeItem(1)], total: 10 }], {
      hasNextPage: true,
      isFetchingNextPage: true,
    });
    render(<NotificationCenter isOpen={true} onClose={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'Loading more notifications...' });
    expect(button.className).toContain('min-h-11');
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('status')).toBeDefined();
  });

  it('renders items from all pages via data.pages.flatMap', () => {
    setupMocks(
      [
        { items: [makeItem(1), makeItem(2)], total: 4 },
        { items: [makeItem(3), makeItem(4)], total: 4 },
      ],
      { hasNextPage: false },
    );
    render(<NotificationCenter isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Test 1')).toBeDefined();
    expect(screen.getByText('Test 2')).toBeDefined();
    expect(screen.getByText('Test 3')).toBeDefined();
    expect(screen.getByText('Test 4')).toBeDefined();
  });
});
