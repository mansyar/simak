import { jsx as _jsx } from 'react/jsx-runtime';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key, params) => {
      if (params) return `${key} ${JSON.stringify(params)}`;
      return key;
    },
  }),
}));
import { FileList } from '@/components/files/file-list';
describe('FileList', () => {
  const mockSubmissions = [
    {
      id: 3,
      version: 3,
      fileName: 'chapter1-v3.pdf',
      fileSize: 3000,
      uploadedAt: new Date('2026-05-22'),
    },
    {
      id: 2,
      version: 2,
      fileName: 'chapter1-v2.pdf',
      fileSize: 2000,
      uploadedAt: new Date('2026-05-21'),
    },
    {
      id: 1,
      version: 1,
      fileName: 'chapter1-v1.pdf',
      fileSize: 1000,
      uploadedAt: new Date('2026-05-20'),
    },
  ];
  it('should render all submission versions', () => {
    render(_jsx(FileList, { submissions: mockSubmissions }));
    expect(screen.getByText('chapter1-v3.pdf')).toBeDefined();
    expect(screen.getByText('chapter1-v2.pdf')).toBeDefined();
    expect(screen.getByText('chapter1-v1.pdf')).toBeDefined();
  });
  it('should render version numbers', () => {
    render(_jsx(FileList, { submissions: mockSubmissions }));
    // Mock i18n returns key with params appended: 'files.version {"version":"3"}'
    expect(screen.getByText('files.version {"version":"3"}')).toBeDefined();
    expect(screen.getByText('files.version {"version":"2"}')).toBeDefined();
    expect(screen.getByText('files.version {"version":"1"}')).toBeDefined();
  });
  it('should show download links for each version', () => {
    const onDownload = vi.fn();
    render(_jsx(FileList, { submissions: mockSubmissions, onDownload: onDownload }));
    // Download buttons use title attribute, not visible text
    const downloadButtons = screen.getAllByTitle('files.download');
    expect(downloadButtons).toHaveLength(3);
  });
  it('should call onDownload when download button is clicked', async () => {
    const userEvent = await import('@testing-library/user-event').then((m) => m.default);
    const onDownload = vi.fn().mockResolvedValue('https://download.url');
    render(_jsx(FileList, { submissions: [mockSubmissions[0]], onDownload: onDownload }));
    const downloadBtn = screen.getByTitle('files.download');
    await userEvent.click(downloadBtn);
    expect(onDownload).toHaveBeenCalledWith(mockSubmissions[0].id);
  });
  it('should display file size in a human-readable format', () => {
    render(_jsx(FileList, { submissions: mockSubmissions }));
    // Multiple file sizes in the table — use getAllByText
    const sizes = screen.getAllByText(/\d+\.?\d*\s*(KB|MB|bytes)/);
    expect(sizes.length).toBe(3);
  });
  it('should show empty state when no submissions exist', () => {
    render(_jsx(FileList, { submissions: [] }));
    expect(screen.getByText('files.empty')).toBeDefined();
  });
});
