import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReviewFilePreview } from '@/components/reviews/ReviewFilePreview';
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key) => key,
  }),
}));
describe('ReviewFilePreview', () => {
  const baseProps = {
    fileName: 'chapter1.pdf',
    fileSize: 2048,
    version: 1,
    uploadedAt: new Date('2026-05-20'),
    downloadUrl: 'https://example.com/file.pdf',
  };
  it('should render file title', () => {
    render(_jsx(ReviewFilePreview, { ...baseProps }));
    expect(screen.getByText('instructorReviews.submittedFile')).toBeDefined();
  });
  it('should render file name', () => {
    render(_jsx(ReviewFilePreview, { ...baseProps }));
    expect(screen.getByText('chapter1.pdf')).toBeDefined();
  });
  it('should render version label', () => {
    render(_jsx(ReviewFilePreview, { ...baseProps }));
    expect(screen.getByText(/versionLabel/)).toBeDefined();
  });
  it('should render download link for PDF', () => {
    render(_jsx(ReviewFilePreview, { ...baseProps }));
    const link = screen.getByText('instructorReviews.downloadPdf').closest('a');
    expect(link?.getAttribute('href')).toBe('https://example.com/file.pdf');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });
  it('should render PDF embed when file is PDF', () => {
    render(_jsx(ReviewFilePreview, { ...baseProps }));
    const embed = document.querySelector('embed');
    expect(embed).toBeDefined();
    expect(embed?.getAttribute('src')).toBe('https://example.com/file.pdf');
  });
  it('should render download file text for non-PDF files', () => {
    render(_jsx(ReviewFilePreview, { ...baseProps, fileName: 'chapter1.docx' }));
    expect(screen.getByText('instructorReviews.downloadFile')).toBeDefined();
  });
  it('should render file size in KB', () => {
    render(_jsx(ReviewFilePreview, { ...baseProps }));
    expect(screen.getByText(/2\.0 KB/)).toBeDefined();
  });
  it('should render file size in MB for large files', () => {
    render(_jsx(ReviewFilePreview, { ...baseProps, fileSize: 2_500_000 }));
    expect(screen.getByText(/2\.4 MB/)).toBeDefined();
  });
});
