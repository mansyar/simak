/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { TemplatePicker } from '@/components/instructor/assignments/TemplatePicker';
import { templateKeys } from '@/lib/query-keys';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      let result = key;
      if (params) {
        result = result.replace(/\{(\w+)\}/g, (_, p) => params[p] ?? `{${p}}`);
      }
      return result;
    },
    locale: 'en',
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

vi.mock('@/server/templates', () => ({
  listTemplates: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

const mockTemplates = [
  { id: 1, name: 'Final Project', type: 'project', checkpoints: ['Proposal', 'Draft', 'Final'] },
  { id: 2, name: 'Lab Report', type: 'report', checkpoints: ['Outline', 'Report'] },
  { id: 3, name: 'Presentation', type: 'presentation', checkpoints: ['Slides', 'Present'] },
];

const mockProps = {
  selectedTemplateId: null,
  onSelectTemplate: vi.fn(),
};

describe('TemplatePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQuery).mockReturnValue({
      data: { templates: mockTemplates },
      isLoading: false,
      isError: false,
    } as never);
  });

  it('loads templates via useQuery with templateKeys.list', () => {
    render(<TemplatePicker {...mockProps} />);
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: templateKeys.list({ page: 1, limit: 100, search: '' }),
      }),
    );
  });

  it('renders template cards when data is loaded', () => {
    render(<TemplatePicker {...mockProps} />);
    expect(screen.getByText('Final Project')).toBeInTheDocument();
    expect(screen.getByText('Lab Report')).toBeInTheDocument();
    expect(screen.getByText('Presentation')).toBeInTheDocument();
  });

  it('shows loading skeletons while loading', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as never);
    render(<TemplatePicker {...mockProps} />);
    expect(screen.queryByText('Final Project')).not.toBeInTheDocument();
  });

  it('fires toast.error on query error', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as never);
    render(<TemplatePicker {...mockProps} />);
    expect(toast.error).toHaveBeenCalledWith('errors.fetchFailed');
  });

  it('filters templates by search input', () => {
    render(<TemplatePicker {...mockProps} />);
    const searchInput = screen.getByPlaceholderText('common.searchByName');
    fireEvent.change(searchInput, { target: { value: 'Lab' } });
    expect(screen.getByText('Lab Report')).toBeInTheDocument();
    expect(screen.queryByText('Final Project')).not.toBeInTheDocument();
  });
});
