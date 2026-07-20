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

describe('NotificationCenter - Read/Unread Filter (FR-3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMocks = (items: any[] = []) => {
    vi.mocked(hooks.useNotificationsList).mockReturnValue({
      data: { items, total: items.length },
      isSuccess: true,
    } as any);
    vi.mocked(hooks.useMarkAllRead).mockReturnValue({
      mutate: vi.fn(),
    } as any);
    vi.mocked(hooks.useMarkRead).mockReturnValue({
      mutate: vi.fn(),
    } as any);
  };

  it('renders All and Unread tabs', () => {
    setupMocks([
      {
        id: 1,
        type: 'review_completed',
        title: 'Test',
        message: 'msg',
        read: false,
        createdAt: new Date().toISOString(),
      },
    ]);
    render(<NotificationCenter isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('All')).toBeDefined();
    expect(screen.getByText('Unread')).toBeDefined();
  });

  it('defaults to All tab', () => {
    setupMocks([
      {
        id: 1,
        type: 'review_completed',
        title: 'Test',
        message: 'msg',
        read: false,
        createdAt: new Date().toISOString(),
      },
    ]);
    render(<NotificationCenter isOpen={true} onClose={vi.fn()} />);
    const allTab = screen.getByText('All').closest('button');
    expect(allTab?.getAttribute('data-state')).toBe('active');
    const unreadTab = screen.getByText('Unread').closest('button');
    expect(unreadTab?.getAttribute('data-state')).toBe('inactive');
  });

  it('switches to Unread tab and passes unreadOnly to useNotificationsList', () => {
    setupMocks([
      {
        id: 1,
        type: 'review_completed',
        title: 'Test',
        message: 'msg',
        read: false,
        createdAt: new Date().toISOString(),
      },
    ]);
    render(<NotificationCenter isOpen={true} onClose={vi.fn()} />);

    // Initial call should have unreadOnly: false (default "All" tab)
    expect(hooks.useNotificationsList).toHaveBeenCalledWith(
      expect.objectContaining({ unreadOnly: false }),
    );

    // Click "Unread" tab
    fireEvent.click(screen.getByText('Unread'));

    // Should now be called with unreadOnly: true
    expect(hooks.useNotificationsList).toHaveBeenCalledWith(
      expect.objectContaining({ unreadOnly: true }),
    );

    // The "Unread" tab should now be active
    const unreadTab = screen.getByText('Unread').closest('button');
    expect(unreadTab?.getAttribute('data-state')).toBe('active');
  });
});
