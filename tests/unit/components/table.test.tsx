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
      <Table>
        <tbody>
          <tr>
            <td>Cell content</td>
          </tr>
        </tbody>
      </Table>,
    );
    expect(screen.getByText('Cell content')).toBeDefined();
  });

  it('renders with sticky header support via container class', () => {
    const { container } = render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>John</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const containerEl = container.querySelector('[data-slot="table-container"]');
    expect(containerEl).toBeDefined();
  });

  it('applies custom className', () => {
    const { container } = render(
      <Table className="custom-class">
        <tbody>
          <tr>
            <td>Content</td>
          </tr>
        </tbody>
      </Table>,
    );
    const table = container.querySelector('[data-slot="table"]');
    expect(table?.className).toContain('custom-class');
  });
});

describe('TableHeader', () => {
  it('renders header content', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Column Name</TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );
    expect(screen.getByText('Column Name')).toBeDefined();
  });
});

describe('TableHead', () => {
  it('renders with sticky positioning class', () => {
    const { container } = render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sticky Header</TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );
    const th = container.querySelector('[data-slot="table-head"]');
    expect(th).toBeDefined();
    expect(th?.className).toContain('sticky');
  });
});

describe('TableRow', () => {
  it('renders with zebra striping class', () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Odd row</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Even row</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const rows = container.querySelectorAll('[data-slot="table-row"]');
    expect(rows.length).toBe(2);
  });

  it('renders with hover state class', () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Row with hover</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const row = container.querySelector('[data-slot="table-row"]');
    expect(row?.className).toContain('hover');
  });
});

describe('TableCell', () => {
  it('renders cell content', () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Data value</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByText('Data value')).toBeDefined();
  });
});

describe('TableFooter', () => {
  it('renders footer content', () => {
    render(
      <Table>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
          </TableRow>
        </TableFooter>
      </Table>,
    );
    expect(screen.getByText('Total')).toBeDefined();
  });
});

describe('TableCaption', () => {
  it('renders caption text', () => {
    render(
      <Table>
        <TableCaption>Table description</TableCaption>
      </Table>,
    );
    expect(screen.getByText('Table description')).toBeDefined();
  });
});
