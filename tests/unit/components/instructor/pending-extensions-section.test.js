import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PendingExtensionsSection } from '@/components/instructor/extensions/PendingExtensionsSection';
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key, params) => {
      const translations = {
        'extensions.queue.title': 'Extension Requests',
        'extensions.queue.pending': 'Pending',
        'extensions.queue.noPending': 'No pending extension requests',
        'extensions.queue.student': 'Student',
        'extensions.queue.checkpoint': 'Checkpoint',
        'extensions.queue.category': 'Category',
        'extensions.queue.reason': 'Reason',
        'extensions.queue.duration': 'Duration',
        'extensions.queue.durationDays': '{count} days',
        'extensions.queue.date': 'Date',
        'extensions.queue.actions': 'Actions',
        'extensions.queue.approve': 'Approve',
        'extensions.queue.reject': 'Reject',
        'extensions.queue.notFound': 'No pending extension requests found',
        'extensions.category.personal': 'Personal',
        'extensions.category.research': 'Research',
        'extensions.category.health': 'Health',
        'extensions.category.other': 'Other',
        'extensions.dialog.approve.title': 'Approve Extension Request',
        'extensions.dialog.approve.description':
          'This will extend the deadline for {student} by {count} days.',
        'extensions.dialog.approve.confirm': 'Confirm Approval',
        'extensions.dialog.approve.cancel': 'Cancel',
        'extensions.dialog.approve.comment': 'Comment (optional)',
        'extensions.dialog.approve.commentPlaceholder': 'Add a note about this approval...',
        'extensions.dialog.reject.title': 'Reject Extension Request',
        'extensions.dialog.reject.description':
          "Provide a reason for rejecting {student}'s request for {count} days.",
        'extensions.dialog.reject.confirm': 'Confirm Rejection',
        'extensions.dialog.reject.cancel': 'Cancel',
        'extensions.dialog.reject.reason': 'Reason for rejection',
        'extensions.dialog.reject.reasonPlaceholder':
          'Explain why this request is being rejected...',
        'extensions.dialog.reject.charCount': '{count}/{min} characters',
      };
      let text = translations[key] || key;
      if (params) {
        Object.keys(params).forEach((p) => {
          text = text.replace(`{${p}}`, String(params[p]));
        });
      }
      return text;
    },
  }),
}));
describe('PendingExtensionsSection', () => {
  const mockRequests = [
    {
      id: 1,
      studentId: 'student-1',
      studentName: 'Alice Cooper',
      checkpointId: 101,
      checkpointName: 'Draft Proposal',
      category: 'personal',
      reason: 'I need more time to complete the research section thoroughly',
      extensionDays: 5,
      status: 'pending',
      createdAt: new Date('2026-05-28T10:00:00Z'),
    },
    {
      id: 2,
      studentId: 'student-2',
      studentName: 'Bob Marley',
      checkpointId: 102,
      checkpointName: 'Final Report',
      category: 'health',
      reason: 'Medical condition has affected my ability to work on this',
      extensionDays: 3,
      status: 'pending',
      createdAt: new Date('2026-05-29T14:00:00Z'),
    },
  ];
  const mockOnApprove = vi.fn();
  const mockOnReject = vi.fn();
  it('should render title with pending count badge', () => {
    render(
      _jsx(PendingExtensionsSection, {
        requests: mockRequests,
        loading: false,
        onApprove: () => {},
        onReject: () => {},
      }),
    );
    expect(screen.getByText('Extension Requests')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
  });
  it('should render student names', () => {
    render(
      _jsx(PendingExtensionsSection, {
        requests: mockRequests,
        loading: false,
        onApprove: () => {},
        onReject: () => {},
      }),
    );
    expect(screen.getByText('Alice Cooper')).toBeDefined();
    expect(screen.getByText('Bob Marley')).toBeDefined();
  });
  it('should render checkpoint names', () => {
    render(
      _jsx(PendingExtensionsSection, {
        requests: mockRequests,
        loading: false,
        onApprove: () => {},
        onReject: () => {},
      }),
    );
    expect(screen.getByText((content) => content.includes('Draft Proposal'))).toBeDefined();
    expect(screen.getByText((content) => content.includes('Final Report'))).toBeDefined();
  });
  it('should render category badges', () => {
    render(
      _jsx(PendingExtensionsSection, {
        requests: mockRequests,
        loading: false,
        onApprove: () => {},
        onReject: () => {},
      }),
    );
    expect(screen.getByText('Personal')).toBeDefined();
    expect(screen.getByText('Health')).toBeDefined();
  });
  it('should render duration', () => {
    render(
      _jsx(PendingExtensionsSection, {
        requests: mockRequests,
        loading: false,
        onApprove: () => {},
        onReject: () => {},
      }),
    );
    expect(screen.getByText('5 days')).toBeDefined();
    expect(screen.getByText('3 days')).toBeDefined();
  });
  it('should render approve and reject buttons for each request', () => {
    render(
      _jsx(PendingExtensionsSection, {
        requests: mockRequests,
        loading: false,
        onApprove: mockOnApprove,
        onReject: mockOnReject,
      }),
    );
    const approveButtons = screen.getAllByText('Approve');
    const rejectButtons = screen.getAllByText('Reject');
    expect(approveButtons).toHaveLength(2);
    expect(rejectButtons).toHaveLength(2);
  });
  it('should show empty state when no pending requests', () => {
    render(
      _jsx(PendingExtensionsSection, {
        requests: [],
        loading: false,
        onApprove: () => {},
        onReject: () => {},
      }),
    );
    expect(screen.getByText('No pending extension requests')).toBeDefined();
  });
  it('should show skeleton placeholders when loading', () => {
    render(
      _jsx(PendingExtensionsSection, {
        requests: mockRequests,
        loading: true,
        onApprove: () => {},
        onReject: () => {},
      }),
    );
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });
  it('should not render checkpoint section when checkpointName is null', () => {
    const requestNoCheckpoint = [{ ...mockRequests[0], checkpointName: null }];
    render(
      _jsx(PendingExtensionsSection, {
        requests: requestNoCheckpoint,
        loading: false,
        onApprove: () => {},
        onReject: () => {},
      }),
    );
    expect(screen.queryByText((content) => content.includes('Checkpoint'))).toBeNull();
  });
  it('should open approve dialog when approve button is clicked', () => {
    render(
      _jsx(PendingExtensionsSection, {
        requests: [mockRequests[0]],
        loading: false,
        onApprove: () => {},
        onReject: () => {},
      }),
    );
    fireEvent.click(screen.getByText('Approve'));
    expect(screen.getByText('Approve Extension Request')).toBeDefined();
  });
  it('should open reject dialog when reject button is clicked', () => {
    render(
      _jsx(PendingExtensionsSection, {
        requests: [mockRequests[0]],
        loading: false,
        onApprove: () => {},
        onReject: () => {},
      }),
    );
    fireEvent.click(screen.getByText('Reject'));
    expect(screen.getByText('Reject Extension Request')).toBeDefined();
  });
  it('should call onApprove after confirming in approve dialog', () => {
    const onApprove = vi.fn();
    render(
      _jsx(PendingExtensionsSection, {
        requests: [mockRequests[0]],
        loading: false,
        onApprove: onApprove,
        onReject: () => {},
      }),
    );
    fireEvent.click(screen.getByText('Approve'));
    fireEvent.click(screen.getByText('Confirm Approval'));
    expect(onApprove).toHaveBeenCalledWith(1, undefined);
  });
  it('should close approve dialog when cancel is clicked', () => {
    render(
      _jsx(PendingExtensionsSection, {
        requests: [mockRequests[0]],
        loading: false,
        onApprove: () => {},
        onReject: () => {},
      }),
    );
    fireEvent.click(screen.getByText('Approve'));
    expect(screen.getByText('Approve Extension Request')).toBeDefined();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Approve Extension Request')).toBeNull();
  });
  it('should close reject dialog when cancel is clicked', () => {
    render(
      _jsx(PendingExtensionsSection, {
        requests: [mockRequests[0]],
        loading: false,
        onApprove: () => {},
        onReject: () => {},
      }),
    );
    fireEvent.click(screen.getByText('Reject'));
    expect(screen.getByText('Reject Extension Request')).toBeDefined();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Reject Extension Request')).toBeNull();
  });
});
