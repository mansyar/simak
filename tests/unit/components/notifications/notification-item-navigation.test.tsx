import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import * as hooks from '@/hooks/use-notifications';

// Mock the i18n context hook
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
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

describe('NotificationItem - navigation (TRACK-012)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a Link with correct href when metadata has assignmentId + checkpointId', () => {
    vi.mocked(hooks.useMarkRead).mockReturnValue({
      mutate: vi.fn(),
    } as any);

    const notification = {
      id: 10,
      userId: 'student-1',
      type: 'review_completed',
      title: 'Review Passed',
      message: 'Approved.',
      read: false,
      channel: 'in_app',
      metadata: { assignmentId: 5, checkpointId: 10 },
      createdAt: new Date().toISOString(),
    };

    const { container } = render(<NotificationItem item={notification as any} />);
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link!.getAttribute('href')).toBe('/student/assignments/5/checkpoints/10');
  });

  it('renders a Link with instructor review href for submission_received', () => {
    vi.mocked(hooks.useMarkRead).mockReturnValue({
      mutate: vi.fn(),
    } as any);

    const notification = {
      id: 11,
      userId: 'instructor-1',
      type: 'submission_received',
      title: 'New Submission',
      message: 'Student submitted work.',
      read: false,
      channel: 'in_app',
      metadata: { submissionId: 42 },
      createdAt: new Date().toISOString(),
    };

    const { container } = render(<NotificationItem item={notification as any} />);
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link!.getAttribute('href')).toBe('/instructor/reviews/42');
  });

  it('calls markAsRead on click before navigation', () => {
    const mockMutate = vi.fn();
    vi.mocked(hooks.useMarkRead).mockReturnValue({
      mutate: mockMutate,
    } as any);

    const notification = {
      id: 10,
      userId: 'student-1',
      type: 'review_completed',
      title: 'Review Passed',
      message: 'Approved.',
      read: false,
      channel: 'in_app',
      metadata: { assignmentId: 5, checkpointId: 10 },
      createdAt: new Date().toISOString(),
    };

    const { container } = render(<NotificationItem item={notification as any} />);
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    fireEvent.click(link!);
    expect(mockMutate).toHaveBeenCalledWith(10);
  });

  it('renders a button (not Link) when metadata is missing', () => {
    vi.mocked(hooks.useMarkRead).mockReturnValue({
      mutate: vi.fn(),
    } as any);

    const notification = {
      id: 10,
      userId: 'student-1',
      type: 'review_completed',
      title: 'Review Passed',
      message: 'Approved.',
      read: false,
      channel: 'in_app',
      metadata: null,
      createdAt: new Date().toISOString(),
    };

    const { container } = render(<NotificationItem item={notification as any} />);
    const link = container.querySelector('a');
    expect(link).toBeNull();
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
  });

  it('calls markAsRead on click even without metadata (no navigation)', () => {
    const mockMutate = vi.fn();
    vi.mocked(hooks.useMarkRead).mockReturnValue({
      mutate: mockMutate,
    } as any);

    const notification = {
      id: 10,
      userId: 'student-1',
      type: 'review_completed',
      title: 'Review Passed',
      message: 'Approved.',
      read: false,
      channel: 'in_app',
      metadata: null,
      createdAt: new Date().toISOString(),
    };

    const { container } = render(<NotificationItem item={notification as any} />);
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    fireEvent.click(button!);
    expect(mockMutate).toHaveBeenCalledWith(10);
  });

  it('does not call markAsRead when notification is already read', () => {
    const mockMutate = vi.fn();
    vi.mocked(hooks.useMarkRead).mockReturnValue({
      mutate: mockMutate,
    } as any);

    const notification = {
      id: 10,
      userId: 'student-1',
      type: 'review_completed',
      title: 'Review Passed',
      message: 'Approved.',
      read: true,
      channel: 'in_app',
      metadata: { assignmentId: 5, checkpointId: 10 },
      createdAt: new Date().toISOString(),
    };

    const { container } = render(<NotificationItem item={notification as any} />);
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    fireEvent.click(link!);
    expect(mockMutate).not.toHaveBeenCalled();
  });
});
