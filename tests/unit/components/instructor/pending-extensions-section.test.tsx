import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PendingExtensionsSection } from '@/components/instructor/extensions/PendingExtensionsSection';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string, params?: any) => {
      const translations: Record<string, string> = {
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
      <PendingExtensionsSection
        requests={mockRequests}
        loading={false}
        onApprove={() => {}}
        onReject={() => {}}
      />,
    );
    expect(screen.getByText('Extension Requests')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
  });

  it('should render student names', () => {
    render(
      <PendingExtensionsSection
        requests={mockRequests}
        loading={false}
        onApprove={() => {}}
        onReject={() => {}}
      />,
    );
    expect(screen.getByText('Alice Cooper')).toBeDefined();
    expect(screen.getByText('Bob Marley')).toBeDefined();
  });

  it('should render checkpoint names', () => {
    render(
      <PendingExtensionsSection
        requests={mockRequests}
        loading={false}
        onApprove={() => {}}
        onReject={() => {}}
      />,
    );
    expect(screen.getByText((content) => content.includes('Draft Proposal'))).toBeDefined();
    expect(screen.getByText((content) => content.includes('Final Report'))).toBeDefined();
  });

  it('should render category badges', () => {
    render(
      <PendingExtensionsSection
        requests={mockRequests}
        loading={false}
        onApprove={() => {}}
        onReject={() => {}}
      />,
    );
    expect(screen.getByText('Personal')).toBeDefined();
    expect(screen.getByText('Health')).toBeDefined();
  });

  it('should render duration', () => {
    render(
      <PendingExtensionsSection
        requests={mockRequests}
        loading={false}
        onApprove={() => {}}
        onReject={() => {}}
      />,
    );
    expect(screen.getByText('5 days')).toBeDefined();
    expect(screen.getByText('3 days')).toBeDefined();
  });

  it('should render approve and reject buttons for each request', () => {
    render(
      <PendingExtensionsSection
        requests={mockRequests}
        loading={false}
        onApprove={mockOnApprove}
        onReject={mockOnReject}
      />,
    );
    const approveButtons = screen.getAllByText('Approve');
    const rejectButtons = screen.getAllByText('Reject');
    expect(approveButtons).toHaveLength(2);
    expect(rejectButtons).toHaveLength(2);
  });

  it('should show empty state when no pending requests', () => {
    render(
      <PendingExtensionsSection
        requests={[]}
        loading={false}
        onApprove={() => {}}
        onReject={() => {}}
      />,
    );
    expect(screen.getByText('No pending extension requests')).toBeDefined();
  });

  it('should show skeleton placeholders when loading', () => {
    render(
      <PendingExtensionsSection
        requests={mockRequests}
        loading={true}
        onApprove={() => {}}
        onReject={() => {}}
      />,
    );
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
