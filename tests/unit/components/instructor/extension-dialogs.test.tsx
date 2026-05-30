import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApproveExtensionDialog } from '@/components/instructor/extensions/ApproveExtensionDialog';
import { RejectExtensionDialog } from '@/components/instructor/extensions/RejectExtensionDialog';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string, params?: any) => {
      const translations: Record<string, string> = {
        'extensions.dialog.approve.title': 'Approve Extension Request',
        'extensions.dialog.approve.confirm': 'Confirm Approval',
        'extensions.dialog.approve.cancel': 'Cancel',
        'extensions.dialog.approve.description':
          'This will extend the deadline for {student} by {count} days.',
        'extensions.dialog.approve.comment': 'Comment (optional)',
        'extensions.dialog.approve.commentPlaceholder': 'Add a note about this approval...',
        'extensions.dialog.reject.title': 'Reject Extension Request',
        'extensions.dialog.reject.confirm': 'Confirm Rejection',
        'extensions.dialog.reject.cancel': 'Cancel',
        'extensions.dialog.reject.description':
          "Provide a reason for rejecting {student}'s request for {count} days.",
        'extensions.dialog.reject.reason': 'Reason for rejection',
        'extensions.dialog.reject.reasonPlaceholder':
          'Explain why this request is being rejected...',
        'extensions.dialog.reject.charCount': '{count}/{min} characters',
        'extensions.dialog.approve.success': 'Extension approved',
        'extensions.dialog.reject.success': 'Extension rejected',
        'extensions.queue.durationDays': '{count} days',
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

const mockRequest = {
  id: 1,
  studentId: 'student-1',
  studentName: 'Alice Cooper',
  checkpointId: 101,
  checkpointName: 'Draft Proposal',
  category: 'personal',
  reason: 'I need more time to complete the research section thoroughly',
  extensionDays: 5,
  status: 'pending' as const,
  createdAt: new Date('2026-05-28T10:00:00Z'),
};

describe('ApproveExtensionDialog', () => {
  it('should render student name in description', () => {
    render(
      <ApproveExtensionDialog
        request={mockRequest}
        open={true}
        onOpenChange={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText(/Alice Cooper/)).toBeDefined();
  });

  it('should render duration in description', () => {
    render(
      <ApproveExtensionDialog
        request={mockRequest}
        open={true}
        onOpenChange={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText(/5/)).toBeDefined();
  });

  it('should render confirm and cancel buttons', () => {
    render(
      <ApproveExtensionDialog
        request={mockRequest}
        open={true}
        onOpenChange={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText('Confirm Approval')).toBeDefined();
    expect(screen.getByText('Cancel')).toBeDefined();
  });

  it('should call onConfirm when confirm is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ApproveExtensionDialog
        request={mockRequest}
        open={true}
        onOpenChange={() => {}}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByText('Confirm Approval'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('RejectExtensionDialog', () => {
  it('should render student name in description', () => {
    render(
      <RejectExtensionDialog
        request={mockRequest}
        open={true}
        onOpenChange={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText(/Alice Cooper/)).toBeDefined();
  });

  it('should render confirm and cancel buttons', () => {
    render(
      <RejectExtensionDialog
        request={mockRequest}
        open={true}
        onOpenChange={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText('Confirm Rejection')).toBeDefined();
    expect(screen.getByText('Cancel')).toBeDefined();
  });

  it('should have confirm button disabled by default (reason too short)', () => {
    render(
      <RejectExtensionDialog
        request={mockRequest}
        open={true}
        onOpenChange={() => {}}
        onConfirm={() => {}}
      />,
    );
    const button = screen.getByText('Confirm Rejection').closest('button');
    expect(button).toHaveProperty('disabled', true);
  });

  it('should show character count', () => {
    render(
      <RejectExtensionDialog
        request={mockRequest}
        open={true}
        onOpenChange={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText(/0.*20.*characters/)).toBeDefined();
  });

  it('should enable confirm button when reason meets min length', () => {
    render(
      <RejectExtensionDialog
        request={mockRequest}
        open={true}
        onOpenChange={() => {}}
        onConfirm={() => {}}
      />,
    );
    const textarea = screen.getByPlaceholderText('Explain why this request is being rejected...');
    fireEvent.change(textarea, {
      target: {
        value:
          'This request is being rejected because it does not meet the minimum criteria for approval.',
      },
    });
    const button = screen.getByText('Confirm Rejection').closest('button');
    expect(button).toHaveProperty('disabled', false);
  });

  it('should show updated character count after typing', () => {
    render(
      <RejectExtensionDialog
        request={mockRequest}
        open={true}
        onOpenChange={() => {}}
        onConfirm={() => {}}
      />,
    );
    const textarea = screen.getByPlaceholderText('Explain why this request is being rejected...');
    fireEvent.change(textarea, {
      target: { value: 'This is a valid rejection reason with enough chars' },
    });
    expect(screen.getByText(/characters/)).toBeDefined();
  });

  it('should call onConfirm with reason when confirm is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <RejectExtensionDialog
        request={mockRequest}
        open={true}
        onOpenChange={() => {}}
        onConfirm={onConfirm}
      />,
    );
    const textarea = screen.getByPlaceholderText('Explain why this request is being rejected...');
    fireEvent.change(textarea, {
      target: {
        value:
          'This request is being rejected because it does not meet the minimum criteria for approval and further review is needed.',
      },
    });
    fireEvent.click(screen.getByText('Confirm Rejection'));
    expect(onConfirm).toHaveBeenCalledWith(
      'This request is being rejected because it does not meet the minimum criteria for approval and further review is needed.',
    );
  });
});
