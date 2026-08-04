import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const {
  mockUseLoaderData,
  mockUseParams,
  mockGetStudentAssignmentDetail,
  mockGetPresignedUploadUrl,
  mockSubmitCheckpoint,
  mockIsServerError,
  mockXhrInstances,
} = vi.hoisted(() => ({
  mockUseLoaderData: vi.fn(),
  mockUseParams: vi.fn().mockReturnValue({ id: '1', checkpointId: '1' }),
  mockGetStudentAssignmentDetail: vi.fn(),
  mockGetPresignedUploadUrl: vi.fn(),
  mockSubmitCheckpoint: vi.fn(),
  mockIsServerError: vi.fn().mockReturnValue(false),
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
  getStudentAssignmentDetail: mockGetStudentAssignmentDetail,
}));
vi.mock('@/server/submissions', () => ({
  listSubmissions: vi.fn(),
  submitCheckpoint: mockSubmitCheckpoint,
}));
vi.mock('@/server/files', () => ({
  getPresignedUploadUrl: mockGetPresignedUploadUrl,
}));
vi.mock('@/server/reviews', () => ({
  getLatestReview: vi.fn(),
}));
vi.mock('@/lib/errors', () => ({
  getErrorTranslationKey: vi.fn(() => 'errors.fetchFailed'),
  isServerError: mockIsServerError,
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
  FileUploader: ({ onUploadSuccess, uploadError, isUploading }: any) => (
    <div>
      {uploadError && <span data-testid="upload-error">{uploadError}</span>}
      <button
        data-testid="upload-trigger"
        disabled={isUploading}
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
vi.mock('@/components/discussions/discussion-panel', () => ({
  DiscussionPanel: () => <div data-testid="discussion-panel" />,
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
    mockSubmitCheckpoint.mockResolvedValue(undefined);
    mockIsServerError.mockImplementation((value: unknown) =>
      Boolean(value && typeof value === 'object' && 'error' in value),
    );
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
    expect(screen.getByTestId('upload-trigger').getAttribute('disabled')).toBeNull();
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
    expect(screen.getByTestId('upload-trigger').getAttribute('disabled')).toBeNull();
  });

  it('resets uploading state when presigned URL creation fails', async () => {
    mockGetPresignedUploadUrl.mockResolvedValue({
      error: { code: 'INTERNAL', message: 'private presign failure' },
    });
    const Component = (Route as any).component as React.FC;
    render(<Component />);

    fireEvent.click(screen.getByTestId('upload-trigger'));

    await waitFor(() =>
      expect(screen.getByTestId('upload-error').textContent).toBe('private presign failure'),
    );
    expect(screen.getByTestId('upload-trigger').getAttribute('disabled')).toBeNull();
  });

  it('resets uploading state when submission recording fails', async () => {
    mockSubmitCheckpoint.mockResolvedValue({
      error: { code: 'INTERNAL', message: 'private submission failure' },
    });
    const Component = (Route as any).component as React.FC;
    render(<Component />);

    fireEvent.click(screen.getByTestId('upload-trigger'));
    const xhr = await waitFor(() => {
      expect(mockXhrInstances).toHaveLength(1);
      return mockXhrInstances[0];
    });

    await act(async () => {
      xhr.onload!();
    });

    await waitFor(() =>
      expect(screen.getByTestId('upload-error').textContent).toBe('private submission failure'),
    );
    expect(screen.getByTestId('upload-trigger').getAttribute('disabled')).toBeNull();
  });

  it('should preserve assignment server errors for an explicit error state', async () => {
    const serverError = {
      error: { code: 'INTERNAL', message: 'private database detail' },
    };
    mockIsServerError.mockImplementation((value: unknown) =>
      Boolean(value && typeof value === 'object' && 'error' in value),
    );
    mockGetStudentAssignmentDetail.mockResolvedValue(serverError);

    const result = await (Route as any).loader({
      params: { id: '1', checkpointId: '1' },
    });

    expect(result).toEqual(serverError);
  });
});
