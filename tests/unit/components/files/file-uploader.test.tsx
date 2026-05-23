import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
  it('should render drag-and-drop zone with correct accept attribute', () => {
    render(<FileUploader onUploadSuccess={vi.fn()} />);
    const fileInput = screen.getByTestId('file-input');
    expect(fileInput).toBeDefined();
    expect(fileInput.getAttribute('accept')).toBe('.docx,.pdf');
  });

  it('should show file type validation error for invalid file type', async () => {
    render(<FileUploader onUploadSuccess={vi.fn()} />);

    // Use fireEvent.change to bypass the accept attribute filter in jsdom
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const fileInput = screen.getByTestId('file-input') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByText('files.validation.invalidType')).toBeDefined();
  });

  it('should show file size validation error for files over 25MB', async () => {
    const user = userEvent.setup();
    render(<FileUploader onUploadSuccess={vi.fn()} />);

    // 26MB file
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

    // First select a file so the upload button (with spinner) appears
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
});
