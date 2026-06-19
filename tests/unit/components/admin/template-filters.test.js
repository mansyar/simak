import { jsx as _jsx, Fragment as _Fragment } from 'react/jsx-runtime';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TemplateFilters } from '@/components/admin/templates/TemplateFilters';
vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key) => {
      const translations = {
        'adminTemplates.searchPlaceholder': 'Search templates...',
        'adminTemplates.filterByType': 'All Types',
      };
      return translations[key] || key;
    },
  }),
}));
vi.mock('@/components/ui/input', () => ({
  Input: (props) => _jsx('input', { 'data-testid': 'search-input', ...props }),
}));
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }) =>
    _jsx('select', {
      'data-testid': 'type-select',
      value: value,
      onChange: (e) => onValueChange?.(e.target.value),
      children: children,
    }),
  SelectContent: ({ children }) => _jsx(_Fragment, { children: children }),
  SelectItem: ({ value, children }) => _jsx('option', { value: value, children: children }),
  SelectTrigger: ({ children }) => _jsx('div', { children: children }),
  SelectValue: ({ placeholder }) => _jsx('span', { children: placeholder }),
}));
describe('TemplateFilters', () => {
  const onSearchChange = vi.fn();
  const onTypeChange = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('should render search input with placeholder', () => {
    render(
      _jsx(TemplateFilters, {
        search: '',
        onSearchChange: onSearchChange,
        type: 'all',
        types: ['Thesis', 'Research Paper'],
        onTypeChange: onTypeChange,
      }),
    );
    const searchInput = screen.getByTestId('search-input');
    expect(searchInput).toBeDefined();
    expect(searchInput.getAttribute('placeholder')).toBe('Search templates...');
  });
  it('should render type filter dropdown', () => {
    render(
      _jsx(TemplateFilters, {
        search: '',
        onSearchChange: onSearchChange,
        type: 'all',
        types: ['Thesis', 'Research Paper'],
        onTypeChange: onTypeChange,
      }),
    );
    expect(screen.getByTestId('type-select')).toBeDefined();
  });
  it('should render All Types option and unique type options', () => {
    render(
      _jsx(TemplateFilters, {
        search: '',
        onSearchChange: onSearchChange,
        type: 'all',
        types: ['Thesis', 'Research Paper'],
        onTypeChange: onTypeChange,
      }),
    );
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(3); // All Types + Thesis + Research Paper
    expect(options[0].textContent).toBe('All Types');
    expect(options[1].textContent).toBe('Thesis');
    expect(options[2].textContent).toBe('Research Paper');
  });
  it('should call onSearchChange when search input changes', () => {
    render(
      _jsx(TemplateFilters, {
        search: '',
        onSearchChange: onSearchChange,
        type: 'all',
        types: ['Thesis'],
        onTypeChange: onTypeChange,
      }),
    );
    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'thesis' } });
    expect(onSearchChange).toHaveBeenCalledWith('thesis');
  });
  it('should display selected type value when type is set', () => {
    render(
      _jsx(TemplateFilters, {
        search: '',
        onSearchChange: onSearchChange,
        type: 'Thesis',
        types: ['Thesis', 'Research Paper'],
        onTypeChange: onTypeChange,
      }),
    );
    const selectEl = screen.getByTestId('type-select');
    expect(selectEl.value).toBe('Thesis');
  });
  it('should display current search value', () => {
    render(
      _jsx(TemplateFilters, {
        search: 'thesis',
        onSearchChange: onSearchChange,
        type: 'all',
        types: ['Thesis'],
        onTypeChange: onTypeChange,
      }),
    );
    const searchInput = screen.getByTestId('search-input');
    expect(searchInput.value).toBe('thesis');
  });
  it('should render with empty types array', () => {
    render(
      _jsx(TemplateFilters, {
        search: '',
        onSearchChange: onSearchChange,
        type: 'all',
        types: [],
        onTypeChange: onTypeChange,
      }),
    );
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(1); // Only All Types
    expect(options[0].textContent).toBe('All Types');
  });
  it('should call onTypeChange when type filter selection changes', () => {
    render(
      _jsx(TemplateFilters, {
        search: '',
        onSearchChange: onSearchChange,
        type: 'all',
        types: ['Thesis', 'Research Paper'],
        onTypeChange: onTypeChange,
      }),
    );
    const select = screen.getByTestId('type-select');
    fireEvent.change(select, { target: { value: 'Thesis' } });
    expect(onTypeChange).toHaveBeenCalledWith('Thesis');
  });
  it('should display selected type in filter trigger when type is not "all"', () => {
    render(
      _jsx(TemplateFilters, {
        search: '',
        onSearchChange: onSearchChange,
        type: 'Thesis',
        types: ['Thesis', 'Research Paper'],
        onTypeChange: onTypeChange,
      }),
    );
    const selectTrigger = document.querySelector('[data-slot="select-value"]');
    expect(selectTrigger).toBeDefined();
    expect(selectTrigger?.textContent).toBe('Thesis');
  });
  it('should display placeholder in filter trigger when type is "all"', () => {
    render(
      _jsx(TemplateFilters, {
        search: '',
        onSearchChange: onSearchChange,
        type: 'all',
        types: ['Thesis', 'Research Paper'],
        onTypeChange: onTypeChange,
      }),
    );
    const selectTrigger = document.querySelector('[data-slot="select-value"]');
    expect(selectTrigger).toBeDefined();
    expect(selectTrigger?.textContent).toBe('All Types');
  });
  it('should fallback to "all" when onTypeChange receives empty value', () => {
    render(
      _jsx(TemplateFilters, {
        search: '',
        onSearchChange: onSearchChange,
        type: 'all',
        types: ['Thesis', 'Research Paper'],
        onTypeChange: onTypeChange,
      }),
    );
    const select = screen.getByTestId('type-select');
    fireEvent.change(select, { target: { value: '' } });
    expect(onTypeChange).toHaveBeenCalledWith('all');
  });
  it('should call onTypeChange with empty string fallback to "all" via onValueChange', () => {
    render(
      _jsx(TemplateFilters, {
        search: '',
        onSearchChange: onSearchChange,
        type: 'Thesis',
        types: ['Thesis'],
        onTypeChange: onTypeChange,
      }),
    );
    const select = screen.getByTestId('type-select');
    fireEvent.change(select, { target: { value: '' } });
    expect(onTypeChange).toHaveBeenCalledWith('all');
  });
});
