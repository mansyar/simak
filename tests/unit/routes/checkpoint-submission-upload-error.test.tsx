import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const { mockUseLoaderData, mockUseParams, mockGetPresignedUploadUrl, mockXhrInstances } =
  vi.hoisted(() => ({
    mockUseLoaderData: vi.fn(),
    mockUseParams: vi.fn().mockReturnValue({ id: '1', checkpointId: '1' }),
    mockGetPresignedUploadUrl: vi.fn(),
    mockXhrInstances: [] as any[],
  }));

// Mock XMLHttpRequest with instance tracking
class MockXHR {
  upload: { onprogress: ((e: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  status = 200;
  response = '';

  open = vi.fn();
  setRequestHeader = vi.fn();

  send(_body: unknown) {
    mockXhrInstances.push(this);
  }
}

global.XMLHttpRequest = MockXHR as unknown as typeof XMLHttpRequest;

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

describe('CheckpointSubmissionPage - upload error differentiation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLoaderData.mockReturnValue(mockData);
    mockGetPresignedUploadUrl.mockResolvedValue({
      uploadUrl: 'https://r2.example.com/upload',
      fileKey: 'test-key',
    });
    mockXhrInstances.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should show network error when xhr.onerror fires', async () => {
    const Component = (Route as any).component as React.FC;
    render(<Component />);

    fireEvent.click(screen.getByTestId('upload-trigger'));

    const xhr = await waitFor(() => {
      expect(mockXhrInstances).toHaveLength(1);
      return mockXhrInstances[0];
    });

    await act(async () => {
      xhr.onerror!();
    });

    await waitFor(() => {
      expect(screen.getByTestId('upload-error').textContent).toBe('files.networkError');
    });
  });

  it('should show server error when xhr returns non-2xx status', async () => {
    const Component = (Route as any).component as React.FC;
    render(<Component />);

    fireEvent.click(screen.getByTestId('upload-trigger'));

    const xhr = await waitFor(() => {
      expect(mockXhrInstances).toHaveLength(1);
      return mockXhrInstances[0];
    });

    await act(async () => {
      xhr.status = 500;
      xhr.onload!();
    });

    await waitFor(() => {
      expect(screen.getByTestId('upload-error').textContent).toBe('files.serverError');
    });
  });
});
