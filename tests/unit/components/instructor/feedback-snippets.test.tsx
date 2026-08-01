import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as feedbackFunctions from '@/server/feedback-snippets';
import { FeedbackSnippetsPage } from '@/components/instructor/feedback-snippets/FeedbackSnippetsPage';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe('FeedbackSnippetsPage', () => {
  const activeSnippet = {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Clear explanation',
    category: 'General',
    body: 'Please explain the reasoning in more detail.',
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const archivedSnippet = {
    ...activeSnippet,
    id: '22222222-2222-4222-8222-222222222222',
    archivedAt: new Date(),
  };
  let queryClient: QueryClient;

  function renderPage() {
    return render(
      <QueryClientProvider client={queryClient}>
        <FeedbackSnippetsPage />
      </QueryClientProvider>,
    );
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    vi.spyOn(feedbackFunctions, 'listFeedbackSnippets').mockResolvedValue({
      snippets: [activeSnippet],
    } as any);
    vi.spyOn(feedbackFunctions, 'createFeedbackSnippet').mockResolvedValue({
      snippet: activeSnippet,
    } as any);
    vi.spyOn(feedbackFunctions, 'updateFeedbackSnippet').mockResolvedValue({
      snippet: activeSnippet,
    } as any);
    vi.spyOn(feedbackFunctions, 'archiveFeedbackSnippet').mockResolvedValue({
      success: true,
    } as any);
    vi.spyOn(feedbackFunctions, 'restoreFeedbackSnippet').mockResolvedValue({
      success: true,
    } as any);
  });

  it('renders active snippets by default and searches title/category', async () => {
    renderPage();

    expect(await screen.findByText('Clear explanation')).toBeTruthy();
    expect(screen.getByTestId('feedback-snippets-active-filter')).toBeTruthy();
    expect(screen.getByPlaceholderText('feedbackSnippets.searchPlaceholder')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('feedbackSnippets.searchPlaceholder'), {
      target: { value: 'rubric' },
    });

    await waitFor(() => {
      expect(feedbackFunctions.listFeedbackSnippets).toHaveBeenLastCalledWith({
        data: { archived: false, search: 'rubric' },
      });
    });
  });

  it('switches to archived snippets and offers restore', async () => {
    vi.mocked(feedbackFunctions.listFeedbackSnippets).mockImplementation(
      async ({ data }) =>
        ({
          snippets: data.archived ? [archivedSnippet] : [activeSnippet],
        }) as any,
    );
    renderPage();

    fireEvent.click(await screen.findByTestId('feedback-snippets-archived-filter'));

    expect(await screen.findByText('feedbackSnippets.archived')).toBeTruthy();
    expect(screen.getByText('feedbackSnippets.restore')).toBeTruthy();
    expect(feedbackFunctions.listFeedbackSnippets).toHaveBeenLastCalledWith({
      data: { archived: true, search: '' },
    });
  });

  it('shows loading, empty, and error states', async () => {
    let resolve: (value: unknown) => void = () => undefined;
    vi.mocked(feedbackFunctions.listFeedbackSnippets).mockReturnValueOnce(
      new Promise((promiseResolve) => {
        resolve = promiseResolve;
      }) as any,
    );
    renderPage();
    expect(screen.getByText('feedbackSnippets.loading')).toBeTruthy();
    resolve({ snippets: [] });
    expect(await screen.findByText('feedbackSnippets.empty')).toBeTruthy();

    vi.mocked(feedbackFunctions.listFeedbackSnippets).mockRejectedValueOnce(new Error('network'));
    fireEvent.change(screen.getByPlaceholderText('feedbackSnippets.searchPlaceholder'), {
      target: { value: 'retry' },
    });
    expect(await screen.findByText('feedbackSnippets.loadError')).toBeTruthy();
  });

  it('validates required fields and creates a snippet with translated success feedback', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('feedback-snippets-create'));
    fireEvent.click(screen.getByTestId('feedback-snippet-submit'));

    expect(await screen.findByText('feedbackSnippets.validation.titleRequired')).toBeTruthy();
    expect(screen.getByText('feedbackSnippets.validation.bodyRequired')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('feedbackSnippets.titleLabel'), {
      target: { value: 'New snippet' },
    });
    fireEvent.change(screen.getByLabelText('feedbackSnippets.bodyLabel'), {
      target: { value: 'Useful feedback' },
    });
    fireEvent.click(screen.getByTestId('feedback-snippet-submit'));

    await waitFor(() =>
      expect(feedbackFunctions.createFeedbackSnippet).toHaveBeenCalledWith({
        data: { title: 'New snippet', category: null, body: 'Useful feedback' },
      }),
    );
    expect(await screen.findByText('feedbackSnippets.created')).toBeTruthy();
  });

  it('edits a snippet and preserves the form after validation errors', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId(`feedback-snippet-edit-${activeSnippet.id}`));
    const title = screen.getByLabelText('feedbackSnippets.titleLabel');
    expect((title as HTMLInputElement).value).toBe('Clear explanation');

    fireEvent.change(title, { target: { value: 'Updated title' } });
    fireEvent.click(screen.getByTestId('feedback-snippet-submit'));

    await waitFor(() =>
      expect(feedbackFunctions.updateFeedbackSnippet).toHaveBeenCalledWith({
        data: {
          id: activeSnippet.id,
          title: 'Updated title',
          category: 'General',
          body: activeSnippet.body,
        },
      }),
    );
  });

  it('requires archive confirmation and supports restore', async () => {
    Object.defineProperty(window, 'confirm', { value: vi.fn(() => true), configurable: true });
    renderPage();
    fireEvent.click(await screen.findByTestId(`feedback-snippet-archive-${activeSnippet.id}`));
    await waitFor(() =>
      expect(feedbackFunctions.archiveFeedbackSnippet).toHaveBeenCalledWith({
        data: { id: activeSnippet.id },
      }),
    );

    vi.mocked(feedbackFunctions.listFeedbackSnippets).mockResolvedValueOnce({
      snippets: [archivedSnippet],
    } as any);
    fireEvent.click(screen.getByTestId('feedback-snippets-archived-filter'));
    fireEvent.click(await screen.findByTestId(`feedback-snippet-restore-${archivedSnippet.id}`));
    await waitFor(() =>
      expect(feedbackFunctions.restoreFeedbackSnippet).toHaveBeenCalledWith({
        data: { id: archivedSnippet.id },
      }),
    );
  });
});
