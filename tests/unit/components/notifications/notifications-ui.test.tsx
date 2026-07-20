import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { NotificationBadge } from '@/components/notifications/NotificationBadge';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import * as hooks from '@/hooks/use-notifications';

// Mock the i18n context hook
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => {
      if (key === 'notifications.title') return 'Notifications';
      if (key === 'notifications.markAllRead') return 'Mark all read';
      if (key === 'notifications.empty') return 'No notifications yet';
      if (key === 'notifications.groups.newReviews') return 'New Reviews';
      if (key === 'notifications.groups.consultations') return 'Consultation Updates';
      return key;
    },
  }),
}));

// Mock the hooks
vi.mock('@/hooks/use-notifications', () => ({
  useUnreadCount: vi.fn(),
  useNotificationsList: vi.fn(),
  useMarkRead: vi.fn(),
  useMarkAllRead: vi.fn(),
}));

// Capture Sheet props for testing (onOpenChange wiring, side prop)
const sheetState = vi.hoisted(() => ({
  onOpenChange: null as ((open: boolean) => void) | null,
  lastSide: null as string | null,
}));

// Mock the Sheet component (UX-15 refactor)
vi.mock('@/components/ui/sheet', () => {
  const Sheet = ({ children, open, onOpenChange }: any) => {
    sheetState.onOpenChange = onOpenChange;
    return open ? <div data-slot="sheet">{children}</div> : null;
  };
  const SheetContent = ({ children, side, ...rest }: any) => {
    sheetState.lastSide = side;
    return (
      <div data-slot="sheet-content" data-side={side} {...rest}>
        {children}
      </div>
    );
  };
  return {
    Sheet,
    SheetContent,
    SheetHeader: ({ children }: any) => <div data-slot="sheet-header">{children}</div>,
    SheetFooter: ({ children }: any) => <div data-slot="sheet-footer">{children}</div>,
    SheetTitle: ({ children }: any) => <h2 data-slot="sheet-title">{children}</h2>,
    SheetDescription: ({ children }: any) => <p data-slot="sheet-description">{children}</p>,
    SheetClose: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  };
});

describe('Notification UI Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sheetState.onOpenChange = null;
    sheetState.lastSide = null;
  });

  describe('NotificationBadge', () => {
    it('renders bell icon and does not show badge when unread count is 0', () => {
      vi.mocked(hooks.useUnreadCount).mockReturnValue({
        data: 0,
        isSuccess: true,
      } as any);

      const onOpen = vi.fn();
      render(<NotificationBadge onOpen={onOpen} />);

      // Should render bell button
      const btn = screen.getByRole('button', { name: /notification/i });
      expect(btn).toBeDefined();

      // Unread count badge should not be in the document
      expect(screen.queryByText('0')).toBeNull();
    });

    it('renders unread count badge when count is greater than 0', () => {
      vi.mocked(hooks.useUnreadCount).mockReturnValue({
        data: 5,
        isSuccess: true,
      } as any);

      const onOpen = vi.fn();
      render(<NotificationBadge onOpen={onOpen} />);

      // Unread count badge should display "5"
      const badge = screen.getByText('5');
      expect(badge).toBeDefined();

      // Clicking opens the panel
      const btn = screen.getByRole('button', { name: /notification/i });
      fireEvent.click(btn);
      expect(onOpen).toHaveBeenCalled();
    });
  });

  describe('NotificationItem', () => {
    const sampleNotification = {
      id: 10,
      userId: 'student-1',
      type: 'review_completed',
      title: 'Review Passed',
      message: 'Your thesis chapter has been approved.',
      read: false,
      channel: 'in_app',
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 mins ago
    };

    it('renders title, message, relative time, and calls mutate on click', () => {
      const mockMutate = vi.fn();
      vi.mocked(hooks.useMarkRead).mockReturnValue({
        mutate: mockMutate,
      } as any);

      render(<NotificationItem item={sampleNotification} />);

      expect(screen.getByText('Review Passed')).toBeDefined();
      expect(screen.getByText('Your thesis chapter has been approved.')).toBeDefined();

      // Relative time (5m ago / 5 mins ago)
      expect(screen.getByText(/5m|5 min/i)).toBeDefined();

      // Click to mark as read
      const itemRow = screen.getByText('Review Passed').closest('div');
      expect(itemRow).not.toBeNull();
      fireEvent.click(itemRow!);

      expect(mockMutate).toHaveBeenCalledWith(10);
    });
  });

  describe('NotificationCenter', () => {
    it('shows empty state when there are no notifications', () => {
      vi.mocked(hooks.useNotificationsList).mockReturnValue({
        data: { items: [], total: 0 },
        isSuccess: true,
      } as any);

      vi.mocked(hooks.useMarkAllRead).mockReturnValue({
        mutate: vi.fn(),
      } as any);

      render(<NotificationCenter isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('No notifications yet')).toBeDefined();
    });

    it('renders slide-over panel, groups by type, and supports mark all read', () => {
      const sampleItems = [
        {
          id: 1,
          type: 'review_completed',
          title: 'Pass Decision',
          message: 'Review passed.',
          read: false,
          createdAt: new Date().toISOString(),
        },
        {
          id: 2,
          type: 'consultation_verified',
          title: 'Consultation Approved',
          message: 'Log verified.',
          read: true,
          createdAt: new Date().toISOString(),
        },
      ];

      vi.mocked(hooks.useNotificationsList).mockReturnValue({
        data: { items: sampleItems, total: 2 },
        isSuccess: true,
      } as any);

      const mockMarkAllRead = vi.fn();
      vi.mocked(hooks.useMarkAllRead).mockReturnValue({
        mutate: mockMarkAllRead,
      } as any);

      vi.mocked(hooks.useMarkRead).mockReturnValue({
        mutate: vi.fn(),
      } as any);

      render(<NotificationCenter isOpen={true} onClose={vi.fn()} />);

      // Verify group headers
      expect(screen.getByText('New Reviews')).toBeDefined();
      expect(screen.getByText('Consultation Updates')).toBeDefined();

      // Verify items
      expect(screen.getByText('Pass Decision')).toBeDefined();
      expect(screen.getByText('Consultation Approved')).toBeDefined();

      // Mark all read button
      const markBtn = screen.getByText('Mark all read');
      fireEvent.click(markBtn);
      expect(mockMarkAllRead).toHaveBeenCalled();
    });
  });

  describe('NotificationCenter - Sheet refactor (UX-15)', () => {
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

    it('renders using Sheet and SheetContent when open', () => {
      setupMocks();
      const { container } = render(<NotificationCenter isOpen={true} onClose={vi.fn()} />);
      expect(container.querySelector('[data-slot="sheet"]')).not.toBeNull();
      expect(container.querySelector('[data-slot="sheet-content"]')).not.toBeNull();
    });

    it('passes side="right" to SheetContent', () => {
      setupMocks();
      render(<NotificationCenter isOpen={true} onClose={vi.fn()} />);
      expect(sheetState.lastSide).toBe('right');
    });

    it('passes open and onOpenChange (onClose) to Sheet', () => {
      setupMocks();
      const onClose = vi.fn();
      render(<NotificationCenter isOpen={true} onClose={onClose} />);
      expect(sheetState.onOpenChange).toBe(onClose);
    });

    it('does not render Sheet content when closed', () => {
      setupMocks();
      const { container } = render(<NotificationCenter isOpen={false} onClose={vi.fn()} />);
      expect(container.querySelector('[data-slot="sheet"]')).toBeNull();
    });

    it('has no custom backdrop div or manual X close button', () => {
      setupMocks();
      const { container } = render(<NotificationCenter isOpen={true} onClose={vi.fn()} />);
      // After refactor, Sheet handles the backdrop — no manual close button with closePanel aria-label
      expect(container.querySelector('[aria-label="notifications.closePanel"]')).toBeNull();
    });

    it('calls onClose when Sheet signals close (simulating Escape key)', () => {
      setupMocks();
      const onClose = vi.fn();
      render(<NotificationCenter isOpen={true} onClose={onClose} />);
      // Simulate Sheet calling onOpenChange(false) — which happens on Escape/backdrop click
      sheetState.onOpenChange?.(false);
      expect(onClose).toHaveBeenCalledWith(false);
    });

    it('renders notification content inside SheetContent', () => {
      const sampleItems = [
        {
          id: 1,
          type: 'review_completed',
          title: 'Test Review',
          message: 'msg',
          read: false,
          createdAt: new Date().toISOString(),
        },
      ];
      setupMocks(sampleItems);
      const { container } = render(<NotificationCenter isOpen={true} onClose={vi.fn()} />);
      const sheetContent = container.querySelector('[data-slot="sheet-content"]');
      expect(sheetContent).not.toBeNull();
      expect(sheetContent?.textContent).toContain('Notifications');
      expect(sheetContent?.textContent).toContain('Test Review');
    });
  });
});
