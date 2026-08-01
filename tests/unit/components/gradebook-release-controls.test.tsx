import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/server/gradebook', () => ({
  getGradeReleasePreflight: vi.fn(),
  publishGradeRelease: vi.fn(),
  withdrawGradeRelease: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { GradeReleaseControls } from '@/components/gradebook/GradeReleaseControls';
import {
  getGradeReleasePreflight,
  publishGradeRelease,
  withdrawGradeRelease,
} from '@/server/gradebook';

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const preflight = {
  releaseStatus: 'draft' as const,
  activeReleaseVersion: null,
  publishedAt: null,
  eligibleStudents: [{ studentId: 'student-1', studentName: 'Alice', status: 'complete' as const }],
  incompleteStudents: [
    { studentId: 'student-2', studentName: 'Bob', status: 'in_progress' as const },
  ],
  missingStudents: [{ studentId: 'student-3', studentName: 'Cara', status: null }],
  counts: { eligible: 1, incomplete: 1, missing: 1 },
};

describe('GradeReleaseControls', () => {
  beforeEach(() => vi.clearAllMocks());

  it('hides release mutations when the viewer cannot manage the assignment', () => {
    const { container } = renderWithQuery(
      <GradeReleaseControls
        assignmentId={42}
        releaseStatus="draft"
        activeReleaseVersion={null}
        publishedAt={null}
        canManage={false}
      />,
    );

    expect(container.querySelector('button')).toBeNull();
  });

  it('opens preflight and shows eligible, incomplete, and missing counts', async () => {
    vi.mocked(getGradeReleasePreflight).mockResolvedValue(preflight);

    renderWithQuery(
      <GradeReleaseControls
        assignmentId={42}
        releaseStatus="draft"
        activeReleaseVersion={null}
        publishedAt={null}
        canManage
      />,
    );

    expect(screen.getByText('gradebook.release.draft')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'gradebook.release.startPublish' }));

    await waitFor(() => {
      expect(getGradeReleasePreflight).toHaveBeenCalledWith({ data: { assignmentId: 42 } });
    });
    expect(screen.getByText('gradebook.release.preflightTitle')).toBeDefined();
    expect(screen.getByText('gradebook.release.eligibleCount')).toBeDefined();
    expect(screen.getByText('gradebook.release.incompleteCount')).toBeDefined();
    expect(screen.getByText('gradebook.release.missingCount')).toBeDefined();
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('Bob')).toBeDefined();
    expect(screen.getByText('Cara')).toBeDefined();
  });

  it('requires explicit confirmation before publishing and submits the confirmed release', async () => {
    vi.mocked(getGradeReleasePreflight).mockResolvedValue(preflight);
    vi.mocked(publishGradeRelease).mockResolvedValue({
      success: true,
      releaseVersion: 1,
      publishedCount: 1,
      incompleteCount: 1,
      missingCount: 1,
    });

    renderWithQuery(
      <GradeReleaseControls
        assignmentId={42}
        releaseStatus="draft"
        activeReleaseVersion={null}
        publishedAt={null}
        canManage
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'gradebook.release.startPublish' }));
    await screen.findByText('gradebook.release.preflightTitle');

    const publishButton = screen.getByRole('button', { name: 'gradebook.release.publish' });
    expect(publishButton).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'gradebook.release.confirmPublish' }));
    fireEvent.click(publishButton);

    await waitFor(() => {
      expect(publishGradeRelease).toHaveBeenCalledWith({
        data: { assignmentId: 42, confirmed: true },
      });
    });
    expect(screen.getByText('gradebook.release.publishSuccess')).toBeDefined();
  });

  it('requires a withdrawal reason and submits the trimmed reason', async () => {
    vi.mocked(withdrawGradeRelease).mockResolvedValue({ success: true, releaseVersion: 2 });

    renderWithQuery(
      <GradeReleaseControls
        assignmentId={42}
        releaseStatus="published"
        activeReleaseVersion={2}
        publishedAt={new Date('2026-08-02T00:00:00.000Z')}
        canManage
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'gradebook.release.withdraw' }));
    expect(screen.getByText('gradebook.release.withdrawTitle')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'gradebook.release.confirmWithdraw' }));
    expect(screen.getByText('gradebook.release.reasonRequired')).toBeDefined();
    expect(withdrawGradeRelease).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('gradebook.release.withdrawReason'), {
      target: { value: '  Correction required  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'gradebook.release.confirmWithdraw' }));

    await waitFor(() => {
      expect(withdrawGradeRelease).toHaveBeenCalledWith({
        data: { assignmentId: 42, reason: 'Correction required' },
      });
    });
    expect(screen.getByText('gradebook.release.withdrawSuccess')).toBeDefined();
  });
});
