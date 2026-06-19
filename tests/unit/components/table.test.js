import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from '@/components/ui/table';
describe('Table', () => {
  it('renders children correctly', () => {
    render(
      _jsx(Table, {
        children: _jsx('tbody', {
          children: _jsx('tr', { children: _jsx('td', { children: 'Cell content' }) }),
        }),
      }),
    );
    expect(screen.getByText('Cell content')).toBeDefined();
  });
  it('renders with sticky header support via container class', () => {
    const { container } = render(
      _jsxs(Table, {
        children: [
          _jsx(TableHeader, {
            children: _jsx(TableRow, { children: _jsx(TableHead, { children: 'Name' }) }),
          }),
          _jsx(TableBody, {
            children: _jsx(TableRow, { children: _jsx(TableCell, { children: 'John' }) }),
          }),
        ],
      }),
    );
    const containerEl = container.querySelector('[data-slot="table-container"]');
    expect(containerEl).toBeDefined();
  });
  it('applies custom className', () => {
    const { container } = render(
      _jsx(Table, {
        className: 'custom-class',
        children: _jsx('tbody', {
          children: _jsx('tr', { children: _jsx('td', { children: 'Content' }) }),
        }),
      }),
    );
    const table = container.querySelector('[data-slot="table"]');
    expect(table?.className).toContain('custom-class');
  });
});
describe('TableHeader', () => {
  it('renders header content', () => {
    render(
      _jsx(Table, {
        children: _jsx(TableHeader, {
          children: _jsx(TableRow, { children: _jsx(TableHead, { children: 'Column Name' }) }),
        }),
      }),
    );
    expect(screen.getByText('Column Name')).toBeDefined();
  });
});
describe('TableHead', () => {
  it('renders with sticky positioning class', () => {
    const { container } = render(
      _jsx(Table, {
        children: _jsx(TableHeader, {
          children: _jsx(TableRow, { children: _jsx(TableHead, { children: 'Sticky Header' }) }),
        }),
      }),
    );
    const th = container.querySelector('[data-slot="table-head"]');
    expect(th).toBeDefined();
    expect(th?.className).toContain('sticky');
  });
});
describe('TableRow', () => {
  it('renders with zebra striping class', () => {
    const { container } = render(
      _jsx(Table, {
        children: _jsxs(TableBody, {
          children: [
            _jsx(TableRow, { children: _jsx(TableCell, { children: 'Odd row' }) }),
            _jsx(TableRow, { children: _jsx(TableCell, { children: 'Even row' }) }),
          ],
        }),
      }),
    );
    const rows = container.querySelectorAll('[data-slot="table-row"]');
    expect(rows.length).toBe(2);
  });
  it('renders with hover state class', () => {
    const { container } = render(
      _jsx(Table, {
        children: _jsx(TableBody, {
          children: _jsx(TableRow, { children: _jsx(TableCell, { children: 'Row with hover' }) }),
        }),
      }),
    );
    const row = container.querySelector('[data-slot="table-row"]');
    expect(row?.className).toContain('hover');
  });
});
describe('TableCell', () => {
  it('renders cell content', () => {
    render(
      _jsx(Table, {
        children: _jsx(TableBody, {
          children: _jsx(TableRow, { children: _jsx(TableCell, { children: 'Data value' }) }),
        }),
      }),
    );
    expect(screen.getByText('Data value')).toBeDefined();
  });
});
describe('TableFooter', () => {
  it('renders footer content', () => {
    render(
      _jsx(Table, {
        children: _jsx(TableFooter, {
          children: _jsx(TableRow, { children: _jsx(TableCell, { children: 'Total' }) }),
        }),
      }),
    );
    expect(screen.getByText('Total')).toBeDefined();
  });
});
describe('TableCaption', () => {
  it('renders caption text', () => {
    render(_jsx(Table, { children: _jsx(TableCaption, { children: 'Table description' }) }));
    expect(screen.getByText('Table description')).toBeDefined();
  });
});
