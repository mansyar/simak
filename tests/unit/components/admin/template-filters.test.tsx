import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TemplateFilters } from '@/components/admin/templates/TemplateFilters';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'adminTemplates.searchPlaceholder': 'Search templates...',
        'adminTemplates.filterByType': 'All Types',
      };
      return translations[key] || key;
    },
  }),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input data-testid="search-input" {...props} />,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }: any) => (
    <select
      data-testid="type-select"
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => (
    <span data-testid="select-value-component">{placeholder}</span>
  ),
}));

describe('TemplateFilters', () => {
  const onSearchChange = vi.fn();
  const onTypeChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render search input with placeholder', () => {
    render(
      <TemplateFilters
        search=""
        onSearchChange={onSearchChange}
        type="all"
        types={['Thesis', 'Research Paper']}
        onTypeChange={onTypeChange}
      />,
    );
    const searchInput = screen.getByTestId('search-input');
    expect(searchInput).toBeDefined();
    expect(searchInput.getAttribute('placeholder')).toBe('Search templates...');
  });

  it('should render type filter dropdown', () => {
    render(
      <TemplateFilters
        search=""
        onSearchChange={onSearchChange}
        type="all"
        types={['Thesis', 'Research Paper']}
        onTypeChange={onTypeChange}
      />,
    );
    expect(screen.getByTestId('type-select')).toBeDefined();
  });

  it('should render All Types option and unique type options', () => {
    render(
      <TemplateFilters
        search=""
        onSearchChange={onSearchChange}
        type="all"
        types={['Thesis', 'Research Paper']}
        onTypeChange={onTypeChange}
      />,
    );
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(3); // All Types + Thesis + Research Paper
    expect(options[0].textContent).toBe('All Types');
    expect(options[1].textContent).toBe('Thesis');
    expect(options[2].textContent).toBe('Research Paper');
  });

  it('should call onSearchChange when search input changes', () => {
    render(
      <TemplateFilters
        search=""
        onSearchChange={onSearchChange}
        type="all"
        types={['Thesis']}
        onTypeChange={onTypeChange}
      />,
    );
    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'thesis' } });
    expect(onSearchChange).toHaveBeenCalledWith('thesis');
  });

  it('should display selected type value when type is set', () => {
    render(
      <TemplateFilters
        search=""
        onSearchChange={onSearchChange}
        type="Thesis"
        types={['Thesis', 'Research Paper']}
        onTypeChange={onTypeChange}
      />,
    );
    const selectEl = screen.getByTestId('type-select') as HTMLSelectElement;
    expect(selectEl.value).toBe('Thesis');
  });

  it('should display current search value', () => {
    render(
      <TemplateFilters
        search="thesis"
        onSearchChange={onSearchChange}
        type="all"
        types={['Thesis']}
        onTypeChange={onTypeChange}
      />,
    );
    const searchInput = screen.getByTestId('search-input') as HTMLInputElement;
    expect(searchInput.value).toBe('thesis');
  });

  it('should render with empty types array', () => {
    render(
      <TemplateFilters
        search=""
        onSearchChange={onSearchChange}
        type="all"
        types={[]}
        onTypeChange={onTypeChange}
      />,
    );
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(1); // Only All Types
    expect(options[0].textContent).toBe('All Types');
  });

  it('should call onTypeChange when type filter selection changes', () => {
    render(
      <TemplateFilters
        search=""
        onSearchChange={onSearchChange}
        type="all"
        types={['Thesis', 'Research Paper']}
        onTypeChange={onTypeChange}
      />,
    );
    const select = screen.getByTestId('type-select');
    fireEvent.change(select, { target: { value: 'Thesis' } });
    expect(onTypeChange).toHaveBeenCalledWith('Thesis');
  });

  it('should display selected type in filter trigger when type is not "all"', () => {
    render(
      <TemplateFilters
        search=""
        onSearchChange={onSearchChange}
        type="Thesis"
        types={['Thesis', 'Research Paper']}
        onTypeChange={onTypeChange}
      />,
    );
    // SelectValue component handles display; verify it's rendered
    expect(screen.getByTestId('select-value-component')).toBeDefined();
    // The selected value is shown via the Select's value prop
    const selectEl = screen.getByTestId('type-select') as HTMLSelectElement;
    expect(selectEl.value).toBe('Thesis');
  });

  it('should display placeholder in filter trigger when type is "all"', () => {
    render(
      <TemplateFilters
        search=""
        onSearchChange={onSearchChange}
        type="all"
        types={['Thesis', 'Research Paper']}
        onTypeChange={onTypeChange}
      />,
    );
    // SelectValue component handles display; verify it's rendered
    expect(screen.getByTestId('select-value-component')).toBeDefined();
    const selectEl = screen.getByTestId('type-select') as HTMLSelectElement;
    expect(selectEl.value).toBe('all');
  });

  it('should fallback to "all" when onTypeChange receives empty value', () => {
    render(
      <TemplateFilters
        search=""
        onSearchChange={onSearchChange}
        type="all"
        types={['Thesis', 'Research Paper']}
        onTypeChange={onTypeChange}
      />,
    );
    const select = screen.getByTestId('type-select');
    fireEvent.change(select, { target: { value: '' } });
    expect(onTypeChange).toHaveBeenCalledWith('all');
  });

  it('should call onTypeChange with empty string fallback to "all" via onValueChange', () => {
    render(
      <TemplateFilters
        search=""
        onSearchChange={onSearchChange}
        type="Thesis"
        types={['Thesis']}
        onTypeChange={onTypeChange}
      />,
    );
    const select = screen.getByTestId('type-select');
    fireEvent.change(select, { target: { value: '' } });
    expect(onTypeChange).toHaveBeenCalledWith('all');
  });

  it('should use SelectValue component for display (data-testid="select-value-component")', () => {
    render(
      <TemplateFilters
        search=""
        onSearchChange={onSearchChange}
        type="all"
        types={['Thesis', 'Research Paper']}
        onTypeChange={onTypeChange}
      />,
    );
    expect(screen.getByTestId('select-value-component')).toBeDefined();
  });
});
