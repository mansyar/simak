/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { listFeedbackSnippets } from '@/server/feedback-snippets';
import { FeedbackSnippetPicker } from '@/components/reviews/FeedbackSnippetPicker';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

vi.mock('@/server/feedback-snippets', () => ({
  listFeedbackSnippets: vi.fn(),
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('lucide-react', () => ({
  Search: () => <span aria-hidden="true" />,
}));

const activeSnippet = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Evidence reminder',
  category: 'Rubric',
  body: 'Please connect this claim to specific evidence.',
  archivedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const archivedSnippet = {
  ...activeSnippet,
  id: '22222222-2222-4222-8222-222222222222',
  title: 'Archived reminder',
  archivedAt: new Date('2026-01-02'),
};

const mockUseQuery = vi.mocked(useQuery);
const mockListFeedbackSnippets = vi.mocked(listFeedbackSnippets);

describe('FeedbackSnippetPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListFeedbackSnippets.mockResolvedValue({ snippets: [activeSnippet] });
    mockUseQuery.mockReturnValue({
      data: { snippets: [activeSnippet, archivedSnippet] },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
  });

  it('loads only active snippets through the instructor-scoped query', async () => {
    const onInsert = vi.fn();
    render(<FeedbackSnippetPicker onInsert={onInsert} />);

    const queryOptions = mockUseQuery.mock.calls[0][0] as unknown as {
      queryFn: () => Promise<unknown>;
    };
    await queryOptions.queryFn();

    expect(mockListFeedbackSnippets).toHaveBeenCalledWith({
      data: { archived: false, search: '' },
    });
    expect(screen.getByText(activeSnippet.title)).toBeDefined();
    expect(screen.queryByText(archivedSnippet.title)).toBeNull();
  });

  it('updates the active-snippet query when searching by title or category', async () => {
    render(<FeedbackSnippetPicker onInsert={vi.fn()} />);

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'rubric' } });

    await waitFor(() => {
      const latestOptions = mockUseQuery.mock.calls.at(-1)?.[0] as { queryKey: unknown[] };
      expect(latestOptions.queryKey).toContainEqual({ archived: false, search: 'rubric' });
    });
  });

  it('renders an empty state when no active snippets are available', () => {
    mockUseQuery.mockReturnValue({
      data: { snippets: [] },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    render(<FeedbackSnippetPicker onInsert={vi.fn()} />);

    expect(screen.getByText('feedbackSnippets.pickerEmpty')).toBeDefined();
  });

  it('supports keyboard-accessible selection and explicit insertion', () => {
    const onInsert = vi.fn();
    render(<FeedbackSnippetPicker onInsert={onInsert} />);

    const option = screen.getByRole('button', { name: /Evidence reminder/ });
    expect(option.getAttribute('type')).toBe('button');
    expect(option.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(option);
    expect(option.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'feedbackSnippets.pickerInsert' }));

    expect(onInsert).toHaveBeenCalledWith(activeSnippet.body);
  });
});
