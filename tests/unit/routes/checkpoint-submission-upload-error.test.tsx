import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { mockUseLoaderData, mockUseParams, mockGetPresignedUploadUrl } = vi.hoisted(() => ({
  mockUseLoaderData: vi.fn(),
  mockUseParams: vi.fn().mockReturnValue({ id: '1', checkpointId: '1' }),
  mockGetPresignedUploadUrl: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn().mockReturnValue((config: any) => ({
    ...config,
    useLoaderData: () => mockUseLoaderData(),
    useParams: () => mockUseParams(),
  })),
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: vi.fn().mockReturnValue(vi.fn()),
}));

vi.mock('@/server/assignments', () => ({
  getStudentAssignmentDetail: vi.fn(),
}));
vi.mock('@/server/submissions', () => ({
  listSubmissions: vi.fn(),
  submitCheckpoint: vi.fn(),
}));
vi.mock('@/server/files', () => ({
  getPresignedUploadUrl: mockGetPresignedUploadUrl,
}));
vi.mock('@/server/reviews', () => ({
  getLatestReview: vi.fn(),
}));
vi.mock('@/lib/errors', () => ({
  isServerError: vi.fn().mockReturnValue(false),
}));
vi.mock('@/i18n', () => ({
  detectLocale: vi.fn().mockReturnValue('en'),
}));
vi.mock('@/lib/i18n-server', () => ({
  translateKey: vi.fn().mockReturnValue('translated'),
}));
vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

vi.mock('@/components/files/file-uploader', () => ({
  FileUploader: ({ onUploadSuccess, uploadError }: any) => (
    <div>
      {uploadError && <span data-testid="upload-error">{uploadError}</span>}
      <button
        data-testid="upload-trigger"
        onClick={() => onUploadSuccess(new File([''], 'test.pdf'))}
      >
        Upload
      </button>
    </div>
  ),
}));
vi.mock('@/components/files/file-list', () => ({
  FileList: () => null,
}));
vi.mock('@/components/files/submission-status', () => ({
  SubmissionStatus: () => null,
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/components/ui/empty-state', () => ({
  EmptyState: () => null,
}));
vi.mock('@/components/ui/pagination', () => ({
  Pagination: () => null,
}));
vi.mock('@/components/student/assignments/StudentAssignmentLoadingSkeleton', () => ({
  StudentAssignmentLoadingSkeleton: () => null,
}));
vi.mock('lucide-react', () => ({
  SearchX: () => null,
  ChevronLeft: () => null,
}));
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
  Route: {},
}));
vi.mock('../../../__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
  Route: {},
}));

import { Route } from '@/routes/_authenticated/student/assignments/$id.checkpoints.$checkpointId';

const mockData = {
  assignmentId: 1,
  assignmentTitle: 'Test Assignment',
  checkpoint: { id: 1, state: 'unlocked', name: 'Checkpoint 1' },
  submissions: [],
  submissionTotal: 0,
  latestReview: null,
};

const originalFetch = global.fetch;

describe('CheckpointSubmissionPage - upload error differentiation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLoaderData.mockReturnValue(mockData);
    mockGetPresignedUploadUrl.mockResolvedValue({
      uploadUrl: 'https://r2.example.com/upload',
      fileKey: 'test-key',
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should show network error when fetch throws TypeError', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as any;

    const Component = (Route as any).component as React.FC;
    render(<Component />);

    fireEvent.click(screen.getByTestId('upload-trigger'));

    await waitFor(() => {
      expect(screen.getByTestId('upload-error').textContent).toBe('files.networkError');
    });
  });

  it('should show server error when fetch returns non-2xx response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as any;

    const Component = (Route as any).component as React.FC;
    render(<Component />);

    fireEvent.click(screen.getByTestId('upload-trigger'));

    await waitFor(() => {
      expect(screen.getByTestId('upload-error').textContent).toBe('files.serverError');
    });
  });
});
