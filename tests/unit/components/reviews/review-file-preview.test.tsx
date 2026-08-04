import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ReviewFilePreview } from '@/components/reviews/ReviewFilePreview';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const mockConvertToHtml = vi.fn();
vi.mock('mammoth', () => ({
  convertToHtml: mockConvertToHtml,
}));

describe('ReviewFilePreview', () => {
  const baseProps = {
    fileName: 'chapter1.pdf',
    fileSize: 2048,
    version: 1,
    uploadedAt: new Date('2026-05-20'),
    downloadUrl: 'https://example.com/file.pdf',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render file title', () => {
    render(<ReviewFilePreview {...baseProps} />);
    expect(screen.getByText('instructorReviews.submittedFile')).toBeDefined();
  });

  it('should render file name', () => {
    render(<ReviewFilePreview {...baseProps} />);
    expect(screen.getByText('chapter1.pdf')).toBeDefined();
  });

  it('should render version label', () => {
    render(<ReviewFilePreview {...baseProps} />);
    expect(screen.getByText(/versionLabel/)).toBeDefined();
  });

  it('should render download link for PDF', () => {
    render(<ReviewFilePreview {...baseProps} />);
    const link = screen.getByText('instructorReviews.downloadPdf').closest('a');
    expect(link?.getAttribute('href')).toBe('https://example.com/file.pdf');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link?.className).toContain('min-h-11');
  });

  it('should render PDF embed when file is PDF', () => {
    render(<ReviewFilePreview {...baseProps} />);
    const embed = document.querySelector('embed');
    expect(embed).toBeDefined();
    expect(embed?.getAttribute('src')).toBe('https://example.com/file.pdf');
  });

  it('should render download file text for non-PDF files', () => {
    render(<ReviewFilePreview {...baseProps} fileName="chapter1.txt" />);
    expect(screen.getByText('instructorReviews.downloadFile')).toBeDefined();
  });

  it('should render file size in KB', () => {
    render(<ReviewFilePreview {...baseProps} />);
    expect(screen.getByText(/2\.0 KB/)).toBeDefined();
  });

  it('should render file size in MB for large files', () => {
    render(<ReviewFilePreview {...baseProps} fileSize={2_500_000} />);
    expect(screen.getByText(/2\.4 MB/)).toBeDefined();
  });

  it('should show "Preview not available" message for non-PDF/non-DOCX files (FR-5)', () => {
    render(<ReviewFilePreview {...baseProps} fileName="chapter1.txt" />);
    expect(screen.getByText('files.previewNotAvailable')).toBeDefined();
  });

  it('should not show "Preview not available" message for PDF files (FR-5)', () => {
    render(<ReviewFilePreview {...baseProps} />);
    expect(screen.queryByText('files.previewNotAvailable')).toBeNull();
  });

  it('should not render embed for non-PDF files', () => {
    render(<ReviewFilePreview {...baseProps} fileName="chapter1.txt" />);
    expect(document.querySelector('embed')).toBeNull();
  });

  it('should still render download button for non-PDF files with preview message (FR-5)', () => {
    render(<ReviewFilePreview {...baseProps} fileName="chapter1.txt" />);
    expect(screen.getByText('instructorReviews.downloadFile')).toBeDefined();
    expect(screen.getByText('files.previewNotAvailable')).toBeDefined();
  });

  // --- FR-1: DOCX Inline Preview ---

  it('should show loading state when converting DOCX file', () => {
    mockConvertToHtml.mockReturnValue(new Promise(() => {})); // never resolves
    global.fetch = vi.fn().mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    }) as unknown as typeof fetch;

    render(<ReviewFilePreview {...baseProps} fileName="chapter1.docx" />);
    expect(screen.getByText('files.convertingDocx')).toBeDefined();
  });

  it('should show converted HTML in sandboxed iframe after DOCX conversion succeeds', async () => {
    const html = '<p>Converted document content</p>';
    mockConvertToHtml.mockResolvedValue({ value: html, messages: [] });
    global.fetch = vi.fn().mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    }) as unknown as typeof fetch;

    render(<ReviewFilePreview {...baseProps} fileName="chapter1.docx" />);

    await waitFor(() => {
      const iframe = document.querySelector('iframe');
      expect(iframe).toBeDefined();
      expect(iframe?.getAttribute('sandbox')).toBe('');
    });
  });

  it('should show error state when DOCX conversion fails', async () => {
    mockConvertToHtml.mockRejectedValue(new Error('Conversion failed'));
    global.fetch = vi.fn().mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    }) as unknown as typeof fetch;

    render(<ReviewFilePreview {...baseProps} fileName="chapter1.docx" />);

    await waitFor(() => {
      expect(screen.getByText('files.previewNotAvailable')).toBeDefined();
      expect(screen.getByText('files.previewNotAvailable').closest('[role="alert"]')).toBeDefined();
    });
  });

  it('should show too-large message when DOCX file exceeds 10MB', () => {
    render(<ReviewFilePreview {...baseProps} fileName="chapter1.docx" fileSize={11_000_000} />);
    expect(screen.getByText('files.tooLargeForPreview')).toBeDefined();
    expect(mockConvertToHtml).not.toHaveBeenCalled();
  });

  it('should not attempt conversion for DOCX files over 10MB', () => {
    render(<ReviewFilePreview {...baseProps} fileName="chapter1.docx" fileSize={15_000_000} />);
    expect(mockConvertToHtml).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
