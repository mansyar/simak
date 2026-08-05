/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
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
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // `as never` bypasses useQuery's complex return type; mock provides only fields the component reads
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

  it('renders an inline retryable error state when templates fail to load', () => {
    const refetch = vi.fn();
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Network failure'),
      refetch,
    } as never);

    render(<TemplatePicker {...mockProps} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('errors.fetchFailed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('makes template options keyboard-focusable selection buttons', () => {
    render(<TemplatePicker {...mockProps} />);
    const option = screen.getByRole('button', { name: /Final Project/ });
    expect(option.getAttribute('aria-pressed')).toBe('false');
    expect(option.className).toContain('min-h-11');
    option.focus();
    expect(document.activeElement).toBe(option);
  });

  it('triggers onSelectTemplate when a template card is clicked', () => {
    render(<TemplatePicker {...mockProps} />);
    fireEvent.click(screen.getByText('Final Project'));
    expect(mockProps.onSelectTemplate).toHaveBeenCalledWith(mockTemplates[0]);
  });

  it('shows checkpoint preview when a template is selected', () => {
    render(<TemplatePicker selectedTemplateId={1} onSelectTemplate={vi.fn()} />);
    expect(screen.getByText('Proposal')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Final')).toBeInTheDocument();
  });

  it('filters templates by search input', () => {
    render(<TemplatePicker {...mockProps} />);
    const searchInput = screen.getByPlaceholderText('common.searchByName');
    fireEvent.change(searchInput, { target: { value: 'Lab' } });
    expect(screen.getByText('Lab Report')).toBeInTheDocument();
    expect(screen.queryByText('Final Project')).not.toBeInTheDocument();
  });

  it('does not change the fixed server query when typing locally', () => {
    render(<TemplatePicker {...mockProps} />);
    const searchInput = screen.getByPlaceholderText('common.searchByName');

    fireEvent.change(searchInput, { target: { value: 'Lab' } });

    expect(useQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        queryKey: templateKeys.list({ page: 1, limit: 100, search: '' }),
      }),
    );
  });

  it('memoizes searchable template fields when selection changes', () => {
    let nameReads = 0;
    let typeReads = 0;
    const trackedTemplates = [
      {
        id: 1,
        get name() {
          nameReads += 1;
          return 'Final Project';
        },
        get type() {
          typeReads += 1;
          return 'project';
        },
        checkpoints: ['Proposal'],
      },
    ];
    vi.mocked(useQuery).mockReturnValue({
      data: { templates: trackedTemplates },
      isLoading: false,
      isError: false,
    } as never);

    const { rerender } = render(<TemplatePicker {...mockProps} />);
    const initialNameReads = nameReads;
    const initialTypeReads = typeReads;

    rerender(<TemplatePicker {...mockProps} selectedTemplateId={1} />);

    expect(nameReads).toBe(initialNameReads + 2);
    expect(typeReads).toBe(initialTypeReads + 1);
  });
});
