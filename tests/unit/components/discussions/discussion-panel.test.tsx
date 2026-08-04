import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { toast } from 'sonner';
import { discussionKeys } from '@/lib/query-keys';
import { authClient } from '@/lib/auth-client';
import { DiscussionPanel } from '@/components/discussions/discussion-panel';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('lucide-react', () => ({
  MessageCircle: (props: any) => <svg data-testid="message-circle-icon" {...props} />,
  AlertCircle: (props: any) => <svg data-testid="alert-circle-icon" {...props} />,
  Send: (props: any) => <svg data-testid="send-icon" {...props} />,
  Trash2: (props: any) => <svg data-testid="trash-icon" {...props} />,
  CornerDownRight: (props: any) => <svg data-testid="reply-icon" {...props} />,
  X: (props: any) => <svg data-testid="x-icon" {...props} />,
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'en' as const,
  }),
}));

vi.mock('@/lib/format', () => ({
  formatRelativeTime: () => '5 minutes ago',
}));

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: vi.fn(),
  },
}));

vi.mock('@/server/discussions', () => ({
  listDiscussionMessages: vi.fn(),
  postDiscussionMessage: vi.fn(),
  deleteOwnMessage: vi.fn(),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, type, disabled, loading, onClick, ...props }: any) => (
    <button type={type || 'button'} disabled={disabled || loading} onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: any) => <textarea data-testid="discussion-input" {...props} />,
}));

const mockStudentUser = {
  id: 'student-1',
  role: 'student',
  name: 'John Doe',
} as any;
const mockInstructorUser = {
  id: 'instructor-1',
  role: 'instructor',
  name: 'Dr. Smith',
} as any;

const mockMessages = {
  messages: [
    {
      id: 1,
      message: 'Hello, I have a question about this checkpoint',
      userId: 'student-1',
      authorName: 'John Doe',
      authorRole: 'student',
      parentMessageId: null,
      createdAt: new Date(),
      deletedAt: null,
    },
    {
      id: 2,
      message: 'Sure, what do you need help with?',
      userId: 'instructor-1',
      authorName: 'Dr. Smith',
      authorRole: 'instructor',
      parentMessageId: null,
      createdAt: new Date(),
      deletedAt: null,
    },
  ],
  total: 2,
};

describe('DiscussionPanel', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    vi.mocked(authClient.useSession).mockReturnValue({
      data: { user: mockStudentUser, session: {} as any },
      isPending: false,
      isRefetching: false,
      error: null,
      refetch: vi.fn(),
    } as any);
  });

  function renderPanel(props: Partial<React.ComponentProps<typeof DiscussionPanel>> = {}) {
    return render(
      <QueryClientProvider client={queryClient}>
        <DiscussionPanel checkpointId={1} assignmentId={1} {...props} />
      </QueryClientProvider>,
    );
  }

  async function resolveList(data: any = mockMessages) {
    const mod = await import('@/server/discussions');
    (mod.listDiscussionMessages as any).mockResolvedValue(data);
  }

  async function waitForMessages() {
    await vi.waitFor(() => {
      expect(screen.getByText('Hello, I have a question about this checkpoint')).toBeDefined();
    });
  }

  it('renders messages from query data', async () => {
    await resolveList();
    renderPanel();
    await waitForMessages();
    expect(screen.getByText('Hello, I have a question about this checkpoint')).toBeDefined();
    expect(screen.getByText('Sure, what do you need help with?')).toBeDefined();
  });

  it('renders empty state when no messages', async () => {
    await resolveList({ messages: [], total: 0 });
    renderPanel();
    await vi.waitFor(() => {
      expect(screen.getByTestId('message-circle-icon')).toBeDefined();
    });
    expect(screen.getByText('discussions.empty.title')).toBeDefined();
    expect(screen.getByText('discussions.empty.description')).toBeDefined();
  });

  it('renders loading skeleton while loading', async () => {
    const mod = await import('@/server/discussions');
    (mod.listDiscussionMessages as any).mockReturnValue(new Promise(() => {}));
    renderPanel();
    await vi.waitFor(() => {
      const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  it('renders a retryable error state instead of the empty state when loading fails', async () => {
    const mod = await import('@/server/discussions');
    const refetchError = new Error('database failure');
    (mod.listDiscussionMessages as any).mockRejectedValue(refetchError);
    renderPanel();

    await vi.waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
    expect(screen.getByText('errors.fetchFailed')).toBeDefined();
    expect(screen.queryByText('discussions.empty.title')).toBeNull();
  });

  it('aligns student messages left and instructor messages right', async () => {
    await resolveList();
    renderPanel();
    await waitForMessages();

    const studentContainer = screen
      .getByText('Hello, I have a question about this checkpoint')
      .closest('[data-role]');
    expect(studentContainer?.getAttribute('data-role')).toBe('student');
    expect(studentContainer?.className).toContain('flex-row');

    const instructorContainer = screen
      .getByText('Sure, what do you need help with?')
      .closest('[data-role]');
    expect(instructorContainer?.getAttribute('data-role')).toBe('instructor');
    expect(instructorContainer?.className).toContain('flex-row-reverse');
  });

  it('renders replies indented under parent', async () => {
    await resolveList({
      messages: [
        {
          id: 1,
          message: 'Parent message',
          userId: 'student-1',
          authorName: 'John Doe',
          authorRole: 'student',
          parentMessageId: null,
          createdAt: new Date(),
          deletedAt: null,
        },
        {
          id: 2,
          message: 'Reply message',
          userId: 'instructor-1',
          authorName: 'Dr. Smith',
          authorRole: 'instructor',
          parentMessageId: 1,
          createdAt: new Date(),
          deletedAt: null,
        },
      ],
      total: 2,
    });
    renderPanel();
    await vi.waitFor(() => {
      expect(screen.getByText('Parent message')).toBeDefined();
    });
    const replyContainer = screen.getByText('Reply message').closest('[data-reply]');
    expect(replyContainer).not.toBeNull();
    expect(replyContainer?.className).toContain('ml-');
  });

  it('shows delete button only on own messages within 15-min window', async () => {
    await resolveList();
    renderPanel();
    await waitForMessages();

    const deleteButtons = screen.getAllByTestId('trash-icon');
    // Only the student's own message (id=1) has a delete button
    expect(deleteButtons).toHaveLength(1);
  });

  it('hides delete button after 15-min window', async () => {
    const oldDate = new Date(Date.now() - 20 * 60 * 1000); // 20 minutes ago
    await resolveList({
      messages: [
        {
          id: 1,
          message: 'Old message',
          userId: 'student-1',
          authorName: 'John Doe',
          authorRole: 'student',
          parentMessageId: null,
          createdAt: oldDate,
          deletedAt: null,
        },
      ],
      total: 1,
    });
    renderPanel();
    await vi.waitFor(() => {
      expect(screen.getByText('Old message')).toBeDefined();
    });
    expect(screen.queryByTestId('trash-icon')).toBeNull();
  });

  it('shows deleted placeholder for soft-deleted messages', async () => {
    await resolveList({
      messages: [
        {
          id: 1,
          message: 'Deleted message',
          userId: 'student-1',
          authorName: 'John Doe',
          authorRole: 'student',
          parentMessageId: null,
          createdAt: new Date(),
          deletedAt: new Date(),
        },
      ],
      total: 1,
    });
    renderPanel();
    await vi.waitFor(() => {
      expect(screen.getByText('discussions.deleted')).toBeDefined();
    });
    expect(screen.queryByText('Deleted message')).toBeNull();
  });

  it('disables send button when input is empty', async () => {
    await resolveList();
    renderPanel();
    await waitForMessages();

    const sendButton = screen.getByTestId('send-icon').closest('button');
    expect(sendButton?.disabled).toBe(true);
  });

  it('optimistically inserts message on send', async () => {
    await resolveList();
    const mod = await import('@/server/discussions');
    (mod.postDiscussionMessage as any).mockReturnValue(new Promise(() => {}));
    renderPanel();
    await waitForMessages();

    const input = screen.getByTestId('discussion-input');
    fireEvent.change(input, { target: { value: 'New message' } });

    const form = input.closest('form')!;
    fireEvent.submit(form);

    await vi.waitFor(() => {
      const cache = queryClient.getQueryData<{ messages: any[] }>(discussionKeys.list(1, 1));
      expect(cache?.messages.some((m) => m.message === 'New message')).toBe(true);
    });
  });

  it('optimistically soft-deletes message on delete', async () => {
    await resolveList();
    const mod = await import('@/server/discussions');
    (mod.deleteOwnMessage as any).mockReturnValue(new Promise(() => {}));
    renderPanel();
    await waitForMessages();

    const deleteButton = screen.getByTestId('trash-icon').closest('button');
    fireEvent.click(deleteButton!);

    await vi.waitFor(() => {
      const cache = queryClient.getQueryData<{ messages: any[] }>(discussionKeys.list(1, 1));
      const deletedMsg = cache?.messages.find((m) => m.id === 1);
      expect(deletedMsg?.deletedAt).not.toBeNull();
    });
  });

  it('restores messages on post error', async () => {
    await resolveList();
    const mod = await import('@/server/discussions');
    (mod.postDiscussionMessage as any).mockResolvedValue({
      success: false,
      error: { code: 'INTERNAL', message: 'Server error' },
    });
    renderPanel();
    await waitForMessages();

    const input = screen.getByTestId('discussion-input');
    fireEvent.change(input, { target: { value: 'New message' } });
    fireEvent.submit(input.closest('form')!);

    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Server error');
    });
    // Cache should be restored — no temp message
    const cache = queryClient.getQueryData<{ messages: any[] }>(discussionKeys.list(1, 1));
    expect(cache?.messages.some((m) => m.message === 'New message')).toBe(false);
  });

  it('restores messages on delete error', async () => {
    await resolveList();
    const mod = await import('@/server/discussions');
    (mod.deleteOwnMessage as any).mockResolvedValue({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Deletion window expired' },
    });
    renderPanel();
    await waitForMessages();

    const deleteButton = screen.getByTestId('trash-icon').closest('button');
    fireEvent.click(deleteButton!);

    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Deletion window expired');
    });
    // Cache should be restored — message not soft-deleted
    const cache = queryClient.getQueryData<{ messages: any[] }>(discussionKeys.list(1, 1));
    const msg = cache?.messages.find((m) => m.id === 1);
    expect(msg?.deletedAt).toBeNull();
  });

  it('renders discussions title as h2 (not h3) for proper heading order', async () => {
    await resolveList();
    const { container } = renderPanel();
    await waitForMessages();

    const h2 = container.querySelector('h2');
    expect(h2).not.toBeNull();
    expect(h2?.textContent).toBe('discussions.title');
    const h3 = container.querySelector('h3');
    expect(h3).toBeNull();
  });
});
