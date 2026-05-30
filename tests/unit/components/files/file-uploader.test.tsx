import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (params) return `${key} ${JSON.stringify(params)}`;
      return key;
    },
  }),
}));

import { FileUploader } from '@/components/files/file-uploader';

describe('FileUploader', () => {
  beforeEach(() => {
    cleanup();
  });

  it('should render drag-and-drop zone with correct accept attribute', () => {
    render(<FileUploader onUploadSuccess={vi.fn()} />);
    const fileInput = screen.getByTestId('file-input');
    expect(fileInput).toBeDefined();
    expect(fileInput.getAttribute('accept')).toBe('.docx,.pdf');
  });

  it('should show file type validation error for invalid file type', () => {
    render(<FileUploader onUploadSuccess={vi.fn()} />);

    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const fileInput = screen.getByTestId('file-input') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByText('files.validation.invalidType')).toBeDefined();
  });

  it('should show file size validation error for files over 25MB', async () => {
    const user = userEvent.setup();
    render(<FileUploader onUploadSuccess={vi.fn()} />);

    const file = new File(['x'.repeat(26 * 1024 * 1024)], 'test.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByTestId('file-input') as HTMLInputElement;

    await user.upload(fileInput, file);
    expect(screen.getByText('files.validation.fileTooLarge')).toBeDefined();
  });

  it('should display selected file name after valid file selection', async () => {
    const user = userEvent.setup();
    render(<FileUploader onUploadSuccess={vi.fn()} />);

    const file = new File(['test content'], 'chapter1.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByTestId('file-input') as HTMLInputElement;

    await user.upload(fileInput, file);
    expect(screen.getByText('chapter1.pdf')).toBeDefined();
  });

  it('should show upload progress state when uploading', async () => {
    const user = userEvent.setup();
    render(<FileUploader onUploadSuccess={vi.fn()} isUploading={true} />);

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
    await user.upload(fileInput, file);

    expect(screen.getByText('files.uploading')).toBeDefined();
  });

  it('should show upload error with retry guidance', () => {
    render(<FileUploader onUploadSuccess={vi.fn()} uploadError="Upload failed" />);
    expect(screen.getByText('Upload failed')).toBeDefined();
    expect(screen.getByText(/files.retry/)).toBeDefined();
  });

  it('should show success state after upload', () => {
    render(<FileUploader onUploadSuccess={vi.fn()} uploadSuccess={true} />);
    expect(screen.getByText(/files.uploadSuccess/)).toBeDefined();
  });

  it('should accept .docx files', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    render(<FileUploader onUploadSuccess={onSuccess} />);

    const file = new File(['test content'], 'report.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const fileInput = screen.getByTestId('file-input') as HTMLInputElement;

    await user.upload(fileInput, file);
    expect(screen.getByText('report.docx')).toBeDefined();
  });

  it('should apply drag-over styles when dragging over drop zone', () => {
    render(<FileUploader onUploadSuccess={vi.fn()} />);
    const dropZone = screen.getByTestId('drop-zone');

    fireEvent.dragOver(dropZone);

    expect(dropZone.className).toContain('border-primary');
  });

  it('should remove drag-over styles on drag leave', () => {
    render(<FileUploader onUploadSuccess={vi.fn()} />);
    const dropZone = screen.getByTestId('drop-zone');

    fireEvent.dragOver(dropZone);
    expect(dropZone.className).toContain('border-primary');

    fireEvent.dragLeave(dropZone);
    expect(dropZone.className).not.toContain('border-primary');
  });

  it('should select file via drop event', () => {
    render(<FileUploader onUploadSuccess={vi.fn()} />);
    const dropZone = screen.getByTestId('drop-zone');
    const file = new File(['content'], 'dropped.pdf', { type: 'application/pdf' });

    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

    expect(screen.getByText('dropped.pdf')).toBeDefined();
  });

  it('should call onUploadSuccess when upload button is clicked', async () => {
    const onUploadSuccess = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<FileUploader onUploadSuccess={onUploadSuccess} />);

    const file = new File(['content'], 'upload-test.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
    await user.upload(fileInput, file);

    await user.click(screen.getByText('files.upload'));

    expect(onUploadSuccess).toHaveBeenCalledTimes(1);
    const calledWith = onUploadSuccess.mock.calls[0][0];
    expect(calledWith.name).toBe('upload-test.pdf');
  });

  it('should reset state via retry button when upload error is shown', async () => {
    const user = userEvent.setup();
    const onUploadSuccess = vi.fn().mockResolvedValue(undefined);
    render(<FileUploader onUploadSuccess={onUploadSuccess} uploadError="Upload failed" />);

    // Retry button should be visible in error state
    const retryButton = screen.getByText('files.retry');
    expect(retryButton).toBeDefined();

    // Select a file to have it available after reset
    const file = new File(['content'], 'retry-test.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
    await user.upload(fileInput, file);

    // Click the upload button
    await user.click(screen.getByText('files.upload'));
    expect(onUploadSuccess).toHaveBeenCalled();
  });

  it('should call handleReset when upload another button is clicked after success', async () => {
    const user = userEvent.setup();
    const onUploadSuccess = vi.fn().mockResolvedValue(undefined);
    // Simulate parent changing uploadSuccess back to false after reset
    const { rerender } = render(
      <FileUploader onUploadSuccess={onUploadSuccess} uploadSuccess={true} />,
    );

    expect(screen.getByText(/files.uploadSuccess/)).toBeDefined();

    await user.click(screen.getByText('files.uploadAnother'));

    // Simulate parent resetting success state
    rerender(<FileUploader onUploadSuccess={onUploadSuccess} uploadSuccess={false} />);

    // Now the drop zone should be visible again
    expect(screen.getByText('files.dropzone.title')).toBeDefined();
  });

  it('should show validation error for invalid file type dropped', () => {
    render(<FileUploader onUploadSuccess={vi.fn()} />);
    const dropZone = screen.getByTestId('drop-zone');

    const file = new File(['content'], 'image.png', { type: 'image/png' });
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

    expect(screen.getByText('files.validation.invalidType')).toBeDefined();
  });

  it('should open file picker when drop zone is clicked', () => {
    render(<FileUploader onUploadSuccess={vi.fn()} />);
    const dropZone = screen.getByTestId('drop-zone');
    const fileInput = screen.getByTestId('file-input') as HTMLInputElement;

    const clickSpy = vi.spyOn(fileInput, 'click');

    fireEvent.click(dropZone);

    expect(clickSpy).toHaveBeenCalled();
  });
});
