import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorCode } from '@/lib/errors';

const mockRouterInvalidate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: mockRouterInvalidate }),
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      if (opts && 'count' in opts) return `${key}:${opts.count}`;
      return key;
    },
  }),
}));

vi.mock('@/server/gradebook', () => ({
  recomputeAllGrades: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { RecomputeGradesButton } from '@/components/gradebook/RecomputeGradesButton';
import { recomputeAllGrades } from '@/server/gradebook';
import { toast } from 'sonner';

function renderWithQuery(ui: React.ReactElement, queryClient?: QueryClient) {
  const client = queryClient ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
    queryClient: client,
  };
}

const mockServerError = { error: { code: ErrorCode.INTERNAL, message: 'Failed' } };

describe('RecomputeGradesButton', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders nothing when isAdmin is false', () => {
    const { container } = renderWithQuery(
      <RecomputeGradesButton assignmentId={1} isAdmin={false} />,
    );
    expect(container.querySelector('button')).toBeNull();
  });

  it('renders button when isAdmin is true', () => {
    renderWithQuery(<RecomputeGradesButton assignmentId={1} isAdmin={true} />);
    expect(screen.getByText('gradebook.recomputeAll')).toBeDefined();
  });

  it('opens dialog on button click', () => {
    renderWithQuery(<RecomputeGradesButton assignmentId={1} isAdmin={true} />);
    fireEvent.click(screen.getByText('gradebook.recomputeAll'));
    expect(screen.getByText('gradebook.recomputeConfirm')).toBeDefined();
  });

  it('calls recomputeAllGrades on confirm', async () => {
    vi.mocked(recomputeAllGrades).mockResolvedValue({ success: true, count: 5 });
    renderWithQuery(<RecomputeGradesButton assignmentId={1} isAdmin={true} />);
    fireEvent.click(screen.getByText('gradebook.recomputeAll'));
    fireEvent.click(screen.getByText('common.confirm'));
    await waitFor(() => {
      expect(recomputeAllGrades).toHaveBeenCalledWith({ data: { assignmentId: 1 } });
    });
  });

  it('shows success toast on success', async () => {
    vi.mocked(recomputeAllGrades).mockResolvedValue({ success: true, count: 5 });
    renderWithQuery(<RecomputeGradesButton assignmentId={1} isAdmin={true} />);
    fireEvent.click(screen.getByText('gradebook.recomputeAll'));
    fireEvent.click(screen.getByText('common.confirm'));
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('gradebook.recomputeSuccess:5');
    });
  });

  it('shows error toast on server error', async () => {
    vi.mocked(recomputeAllGrades).mockResolvedValue(mockServerError);
    renderWithQuery(<RecomputeGradesButton assignmentId={1} isAdmin={true} />);
    fireEvent.click(screen.getByText('gradebook.recomputeAll'));
    fireEvent.click(screen.getByText('common.confirm'));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('gradebook.recomputeError');
    });
  });

  it('shows error toast on exception', async () => {
    vi.mocked(recomputeAllGrades).mockRejectedValue(new Error('Network'));
    renderWithQuery(<RecomputeGradesButton assignmentId={1} isAdmin={true} />);
    fireEvent.click(screen.getByText('gradebook.recomputeAll'));
    fireEvent.click(screen.getByText('common.confirm'));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('gradebook.recomputeError');
    });
  });

  it('invalidates gradebook query and router on success (dual invalidation)', async () => {
    vi.mocked(recomputeAllGrades).mockResolvedValue({ success: true, count: 5 });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    renderWithQuery(<RecomputeGradesButton assignmentId={42} isAdmin={true} />, queryClient);
    fireEvent.click(screen.getByText('gradebook.recomputeAll'));
    fireEvent.click(screen.getByText('common.confirm'));
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['gradebook', 'studentFinalGrade', 42],
      });
    });
    expect(mockRouterInvalidate).toHaveBeenCalled();
  });

  it('closes dialog on success', async () => {
    vi.mocked(recomputeAllGrades).mockResolvedValue({ success: true, count: 5 });
    renderWithQuery(<RecomputeGradesButton assignmentId={1} isAdmin={true} />);
    fireEvent.click(screen.getByText('gradebook.recomputeAll'));
    fireEvent.click(screen.getByText('common.confirm'));
    await waitFor(() => {
      expect(screen.queryByText('gradebook.recomputeConfirm')).toBeNull();
    });
  });
});
