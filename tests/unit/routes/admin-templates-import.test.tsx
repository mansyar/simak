/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { parseTemplatesXlsx } from '@/lib/bulk-import/parse-templates';

vi.mock('@tanstack/react-start', () => ({
  useServerFn: vi.fn().mockImplementation((fn) => fn),
}));

vi.mock('@/lib/bulk-import/parse-templates', () => ({
  parseTemplatesXlsx: vi.fn(),
}));

vi.mock('@/lib/bulk-import/samples', () => ({
  generateTemplateSampleXlsx: vi.fn(() => new Blob(['fake'], { type: 'application/octet-stream' })),
}));

vi.mock('@/server/bulk-import', () => ({
  bulkCreateTemplates: vi.fn(),
}));

vi.mock('../../../__root', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/components/ui/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => <div data-testid="page-header">{title}</div>,
}));

vi.mock('@/components/ui/alert-banner', () => ({
  AlertBanner: ({ variant, title, children }: any) => (
    <div data-testid={`alert-${variant}`}>
      <strong>{title}</strong>: {children}
    </div>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} data-testid={props['data-testid']}>
      {children}
    </button>
  ),
}));

function buildXlsx(headers: string[], rows: (string | number)[][] = []): File {
  const { utils, write } = require('xlsx');
  const data = [headers, ...rows];
  const ws = utils.aoa_to_sheet(data);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Sheet1');
  const buf = write(wb, { type: 'array', bookType: 'xlsx' });
  return new File([buf], 'templates.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

async function getComponent() {
  const mod = await import('@/routes/_authenticated/admin/templates/import');
  return mod.Route.options!.component!;
}

describe('BulkTemplateImportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should expose a keyboard-accessible native label for the file picker', async () => {
    const Component = await getComponent();
    render(<Component />);

    const dropzone = screen.getByTestId('bulk-import-dropzone');
    const input = screen.getByTestId('bulk-import-dropzone-input');

    expect(dropzone.tagName).toBe('LABEL');
    expect(input).toHaveAttribute('id');
    expect(screen.getByLabelText(/bulkImport\.common\.dropzoneText/)).toBe(input);
  });

  it('should render the dropzone with upload text', async () => {
    const Component = await getComponent();
    render(<Component />);
    expect(screen.getByTestId('bulk-import-dropzone')).toBeInTheDocument();
    expect(screen.getByText(/bulkImport\.common\.dropzoneText/)).toBeInTheDocument();
  });

  it('should accept only .xlsx files', async () => {
    const Component = await getComponent();
    render(<Component />);
    const input = screen.getByTestId('bulk-import-dropzone-input');
    expect(input).toHaveAttribute('accept', '.xlsx');
  });

  it('should reject files over 5MB', async () => {
    const Component = await getComponent();
    render(<Component />);
    const input = screen.getByTestId('bulk-import-dropzone-input');
    const bigFile = buildXlsx([
      'templateName',
      'type',
      'checkpointName',
      'minConsultations',
      'estimatedDuration',
    ]);
    Object.defineProperty(bigFile, 'size', { value: 6 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [bigFile] } });
    await waitFor(() => {
      expect(screen.getByText(/bulkImport\.common\.fileTooLarge/)).toBeInTheDocument();
    });
  });

  it('should show warning when row limit exceeded', async () => {
    vi.mocked(parseTemplatesXlsx).mockResolvedValueOnce({
      groups: [],
      errors: ['File exceeds 500 row limit (501 checkpoint rows found)'],
    });
    const Component = await getComponent();
    render(<Component />);
    const input = screen.getByTestId('bulk-import-dropzone-input');
    const file = buildXlsx([
      'templateName',
      'type',
      'checkpointName',
      'minConsultations',
      'estimatedDuration',
    ]);
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getAllByText(/bulkImport\.common\.validationErrors/).length).toBeGreaterThan(0);
    });
  });

  it('should parse valid template and show grouped preview', async () => {
    vi.mocked(parseTemplatesXlsx).mockResolvedValueOnce({
      groups: [
        {
          templateName: 'Assignment',
          type: 'Assignment Type',
          checkpoints: [
            { name: 'Research', minConsultations: 0, estimatedDuration: 14 },
            { name: 'Draft', minConsultations: 2, estimatedDuration: 7 },
          ],
          status: 'valid',
        },
      ],
      errors: [],
    });
    const Component = await getComponent();
    render(<Component />);
    const input = screen.getByTestId('bulk-import-dropzone-input');
    const file = buildXlsx([
      'templateName',
      'type',
      'checkpointName',
      'minConsultations',
      'estimatedDuration',
    ]);
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByText('Assignment')).toBeInTheDocument();
      expect(screen.getByText(/1 bulkImport\.common\.valid/)).toBeInTheDocument();
    });
  });

  it('should expose grouped preview expansion as an accessible disclosure button', async () => {
    vi.mocked(parseTemplatesXlsx).mockResolvedValueOnce({
      groups: [
        {
          templateName: 'Assignment',
          type: 'Assignment Type',
          checkpoints: [{ name: 'Research', minConsultations: 0, estimatedDuration: 14 }],
          status: 'valid',
        },
      ],
      errors: [],
    });
    const Component = await getComponent();
    render(<Component />);
    const input = screen.getByTestId('bulk-import-dropzone-input');
    const file = buildXlsx([
      'templateName',
      'type',
      'checkpointName',
      'minConsultations',
      'estimatedDuration',
    ]);
    fireEvent.change(input, { target: { files: [file] } });

    const expandButton = await screen.findByRole('button', { name: 'Assignment' });
    expect(expandButton.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(expandButton);
    expect(expandButton.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Research')).toBeInTheDocument();
  });

  it('should show invalid group status', async () => {
    vi.mocked(parseTemplatesXlsx).mockResolvedValueOnce({
      groups: [
        {
          templateName: 'Bad Template',
          type: '',
          checkpoints: [],
          status: 'invalid',
          error: 'Type is required',
        },
      ],
      errors: [],
    });
    const Component = await getComponent();
    render(<Component />);
    const input = screen.getByTestId('bulk-import-dropzone-input');
    const file = buildXlsx([
      'templateName',
      'type',
      'checkpointName',
      'minConsultations',
      'estimatedDuration',
    ]);
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByText('Bad Template')).toBeInTheDocument();
      expect(screen.getByText(/1 bulkImport\.common\.invalid/)).toBeInTheDocument();
    });
  });

  it('should disable import button when no valid groups', async () => {
    vi.mocked(parseTemplatesXlsx).mockResolvedValueOnce({
      groups: [
        {
          templateName: 'Bad',
          type: '',
          checkpoints: [],
          status: 'invalid',
          error: 'Type is required',
        },
      ],
      errors: [],
    });
    const Component = await getComponent();
    render(<Component />);
    const input = screen.getByTestId('bulk-import-dropzone-input');
    const file = buildXlsx([
      'templateName',
      'type',
      'checkpointName',
      'minConsultations',
      'estimatedDuration',
    ]);
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /bulkImport\.templates\.importButton/ });
      expect(btn).toBeDisabled();
    });
  });

  it('should download sample file', async () => {
    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return { click: clickSpy, href: '', download: '' } as any;
      return originalCreateElement(tag);
    });
    const Component = await getComponent();
    render(<Component />);
    const downloadBtn = screen.getByText(/bulkImport\.common\.downloadSample/);
    fireEvent.click(downloadBtn);
    expect(clickSpy).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
