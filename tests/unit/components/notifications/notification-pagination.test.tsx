import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import * as hooks from '@/hooks/use-notifications';

// Mock the i18n context hook
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => {
      if (key === 'notifications.title') return 'Notifications';
      if (key === 'notifications.markAllRead') return 'Mark all read';
      if (key === 'notifications.empty') return 'No notifications yet';
      if (key === 'notifications.filterAll') return 'All';
      if (key === 'notifications.filterUnread') return 'Unread';
      if (key === 'notifications.loadMore') return 'Load More';
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

  const setupMocks = (items: any[] = [], total: number = items.length) => {
    vi.mocked(hooks.useNotificationsList).mockReturnValue({
      data: { items, total },
      isSuccess: true,
      isFetching: false,
    } as any);
    vi.mocked(hooks.useMarkAllRead).mockReturnValue({
      mutate: vi.fn(),
    } as any);
    vi.mocked(hooks.useMarkRead).mockReturnValue({
      mutate: vi.fn(),
    } as any);
  };

  it('uses limit of 20 (not 50)', () => {
    setupMocks([]);
    render(<NotificationCenter isOpen={true} onClose={vi.fn()} />);
    expect(hooks.useNotificationsList).toHaveBeenCalledWith(expect.objectContaining({ limit: 20 }));
  });

  it('shows Load More button when there are more items to load', () => {
    setupMocks(
      [
        {
          id: 1,
          type: 'review_completed',
          title: 'Test',
          message: 'msg',
          read: false,
          createdAt: new Date().toISOString(),
        },
      ],
      10,
    );
    render(<NotificationCenter isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Load More')).toBeDefined();
  });

  it('hides Load More button when all items are loaded', () => {
    setupMocks(
      [
        {
          id: 1,
          type: 'review_completed',
          title: 'Test',
          message: 'msg',
          read: false,
          createdAt: new Date().toISOString(),
        },
      ],
      1,
    );
    render(<NotificationCenter isOpen={true} onClose={vi.fn()} />);
    expect(screen.queryByText('Load More')).toBeNull();
  });

  it('increments page when Load More is clicked', () => {
    setupMocks(
      [
        {
          id: 1,
          type: 'review_completed',
          title: 'Test',
          message: 'msg',
          read: false,
          createdAt: new Date().toISOString(),
        },
      ],
      10,
    );
    render(<NotificationCenter isOpen={true} onClose={vi.fn()} />);

    // Initial call should have page: 1
    expect(hooks.useNotificationsList).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));

    // Click Load More
    fireEvent.click(screen.getByText('Load More'));

    // Should now be called with page: 2
    expect(hooks.useNotificationsList).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
  });
});
