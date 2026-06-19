import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationBadge } from '@/components/notifications/NotificationBadge';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import * as hooks from '@/hooks/use-notifications';
// Mock the i18n context hook
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key) => {
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
describe('Notification UI Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  describe('NotificationBadge', () => {
    it('renders bell icon and does not show badge when unread count is 0', () => {
      vi.mocked(hooks.useUnreadCount).mockReturnValue({
        data: 0,
        isSuccess: true,
      });
      const onOpen = vi.fn();
      render(_jsx(NotificationBadge, { onOpen: onOpen }));
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
      });
      const onOpen = vi.fn();
      render(_jsx(NotificationBadge, { onOpen: onOpen }));
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
      });
      render(_jsx(NotificationItem, { item: sampleNotification }));
      expect(screen.getByText('Review Passed')).toBeDefined();
      expect(screen.getByText('Your thesis chapter has been approved.')).toBeDefined();
      // Relative time (5m ago / 5 mins ago)
      expect(screen.getByText(/5m|5 min/i)).toBeDefined();
      // Click to mark as read
      const itemRow = screen.getByText('Review Passed').closest('div');
      expect(itemRow).not.toBeNull();
      fireEvent.click(itemRow);
      expect(mockMutate).toHaveBeenCalledWith(10);
    });
  });
  describe('NotificationCenter', () => {
    it('shows empty state when there are no notifications', () => {
      vi.mocked(hooks.useNotificationsList).mockReturnValue({
        data: { items: [], total: 0 },
        isSuccess: true,
      });
      vi.mocked(hooks.useMarkAllRead).mockReturnValue({
        mutate: vi.fn(),
      });
      render(_jsx(NotificationCenter, { isOpen: true, onClose: vi.fn() }));
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
      });
      const mockMarkAllRead = vi.fn();
      vi.mocked(hooks.useMarkAllRead).mockReturnValue({
        mutate: mockMarkAllRead,
      });
      vi.mocked(hooks.useMarkRead).mockReturnValue({
        mutate: vi.fn(),
      });
      render(_jsx(NotificationCenter, { isOpen: true, onClose: vi.fn() }));
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
});
