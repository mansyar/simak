/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import type { ComponentType } from 'react';

const mocks = vi.hoisted(() => ({
  loaderData: {
    assignmentId: 1,
    assignmentTitle: 'Test Assignment',
    checkpoint: { id: 1, state: 'unlocked', name: 'Checkpoint 1' },
    submissions: [],
    submissionTotal: 0,
    latestReview: null,
  },
  fileUploaderProps: {} as Record<string, any>,
  xhrInstances: [] as any[],
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
    mocks.xhrInstances.push(this);
  }
}

global.XMLHttpRequest = MockXHR as unknown as typeof XMLHttpRequest;

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: any) => ({
    ...config,
    useLoaderData: () => mocks.loaderData,
    useParams: () => ({ id: '1', checkpointId: '1' }),
    useNavigate: () => vi.fn(),
  }),
  Link: ({ children }: any) => children,
}));

vi.mock('@/components/files/file-uploader', () => ({
  FileUploader: (props: any) => {
    mocks.fileUploaderProps = props;
    return null;
  },
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
  EmptyState: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/pagination', () => ({
  Pagination: () => null,
}));

vi.mock('@/components/student/assignments/StudentAssignmentLoadingSkeleton', () => ({
  StudentAssignmentLoadingSkeleton: () => null,
}));

vi.mock('@/server/assignments', () => ({
  getStudentAssignmentDetail: vi.fn(),
}));

vi.mock('@/server/submissions', () => ({
  listSubmissions: vi.fn().mockResolvedValue({ submissions: [], total: 0 }),
  submitCheckpoint: vi.fn().mockResolvedValue({ error: undefined }),
}));

vi.mock('@/server/files', () => ({
  getPresignedUploadUrl: vi.fn().mockResolvedValue({
    uploadUrl: 'https://r2.example.com/upload',
    fileKey: 'test-file-key',
  }),
  getPresignedDownloadUrl: vi.fn(),
}));

vi.mock('@/server/reviews', () => ({
  getLatestReview: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/errors', () => ({
  isServerError: () => false,
}));

vi.mock('@/lib/i18n-server', () => ({
  translateKey: vi.fn().mockReturnValue('translated'),
}));

vi.mock('@/i18n', () => ({
  detectLocale: vi.fn().mockReturnValue('en'),
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('lucide-react', () => ({
  SearchX: () => null,
  ChevronLeft: () => null,
}));

import { Route } from '@/routes/_authenticated/student/assignments/$id.checkpoints.$checkpointId';

const CheckpointSubmissionPage = (Route as any).component as ComponentType;

describe('CheckpointSubmissionPage - upload progress', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    cleanup();
    mocks.xhrInstances = [];
    mocks.fileUploaderProps = {};
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('should use XMLHttpRequest (not fetch) for R2 PUT upload', async () => {
    render(<CheckpointSubmissionPage />);

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

    // Start upload (don't await — XHR won't complete until onload is triggered)
    let uploadPromise: Promise<void> | undefined;
    act(() => {
      uploadPromise = mocks.fileUploaderProps.onUploadSuccess(file);
    });

    // Wait for XHR to be created (microtasks need to flush for getPresignedUploadUrl to resolve)
    await vi.waitFor(() => {
      expect(mocks.xhrInstances).toHaveLength(1);
    });

    const xhr = mocks.xhrInstances[0];

    // Verify XMLHttpRequest was used, not fetch
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhr.open).toHaveBeenCalledWith('PUT', 'https://r2.example.com/upload');
    expect(xhr.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');

    // Complete the upload to clean up
    await act(async () => {
      xhr.onload!();
      await uploadPromise;
    });
  });

  it('should update uploadProgress via xhr.upload.onprogress and pass to FileUploader', async () => {
    render(<CheckpointSubmissionPage />);

    // Before upload, uploadProgress should be undefined
    expect(mocks.fileUploaderProps.uploadProgress).toBeUndefined();

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

    let uploadPromise: Promise<void> | undefined;
    act(() => {
      uploadPromise = mocks.fileUploaderProps.onUploadSuccess(file);
    });

    await vi.waitFor(() => {
      expect(mocks.xhrInstances).toHaveLength(1);
    });

    const xhr = mocks.xhrInstances[0];

    // Simulate progress event at 50%
    await act(async () => {
      xhr.upload.onprogress!({
        lengthComputable: true,
        loaded: 50,
        total: 100,
      } as ProgressEvent);
    });

    // uploadProgress should be passed to FileUploader
    expect(mocks.fileUploaderProps.uploadProgress).toBe(50);

    // Simulate progress at 100%
    await act(async () => {
      xhr.upload.onprogress!({
        lengthComputable: true,
        loaded: 100,
        total: 100,
      } as ProgressEvent);
    });

    expect(mocks.fileUploaderProps.uploadProgress).toBe(100);

    // Complete the upload
    await act(async () => {
      xhr.onload!();
      await uploadPromise;
    });
  });
});
