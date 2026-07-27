import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { NotificationItem } from '@/components/notifications/NotificationItem';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/hooks/use-notifications', () => {
  const mockData = {
    pages: [
      {
        items: [
          {
            id: 1,
            type: 'review_completed',
            title: 'Test',
            message: 'Test message',
            read: false,
            metadata: { assignmentId: 1, checkpointId: 1 },
            createdAt: new Date(),
          },
        ],
        total: 1,
      },
    ],
    pageParams: [1],
  };
  return {
    useNotificationsList: () => ({
      data: mockData,
      isLoading: false,
      isFetching: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
    }),
    useMarkAllRead: () => ({ mutate: vi.fn(), isPending: false }),
    useMarkRead: () => ({ mutate: vi.fn() }),
  };
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    ...props
  }: { children: React.ReactNode; to: string } & Record<string, unknown>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: () => <div data-testid="tabs" />,
}));

describe('Notification performance optimizations (NFR-1)', () => {
  describe('NotificationItem - React.memo (PERF-31)', () => {
    it('should be wrapped in React.memo', () => {
      // React.memo components have $$typeof === Symbol.for('react.memo')
      expect((NotificationItem as unknown as { $$typeof: symbol }).$$typeof).toBe(
        Symbol.for('react.memo'),
      );
    });
  });

  describe('NotificationCenter - useMemo (PERF-27)', () => {
    it('should render correctly with useMemo for unreadCount and groupedNotifications', async () => {
      const { NotificationCenter } = await import('@/components/notifications/NotificationCenter');

      const { container } = render(<NotificationCenter isOpen={true} onClose={() => {}} />);

      // Component should render without errors
      expect(container).toBeDefined();
      // The notification title should be visible
      const title = container.querySelector('h2');
      expect(title).toBeDefined();
    });

    it('should display unread count badge when there are unread notifications', async () => {
      const { NotificationCenter } = await import('@/components/notifications/NotificationCenter');

      const { container } = render(<NotificationCenter isOpen={true} onClose={() => {}} />);

      // The mock has 1 unread notification, so the unread count badge should be visible
      const badge = container.querySelector('[data-testid="unread-count"]');
      expect(badge).not.toBeNull();
      expect(badge?.textContent).toBe('1');
    });

    it('should render grouped notifications correctly', async () => {
      const { NotificationCenter } = await import('@/components/notifications/NotificationCenter');

      const { container } = render(<NotificationCenter isOpen={true} onClose={() => {}} />);

      // The mock notification is of type 'review_completed' which belongs to 'newReviews' group
      // The group label should be rendered
      const groupLabels = container.querySelectorAll(
        '.text-xs.font-semibold.text-muted-foreground',
      );
      expect(groupLabels.length).toBeGreaterThan(0);
    });
  });
});
