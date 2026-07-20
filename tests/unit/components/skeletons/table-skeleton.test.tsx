import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TableSkeleton } from '@/components/skeletons/table-skeleton';

describe('TableSkeleton', () => {
  it('should render skeleton elements', () => {
    render(<TableSkeleton />);
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render default 5 skeleton rows', () => {
    render(<TableSkeleton />);
    const rows = screen.getAllByRole('row');
    // 1 header row + 5 body rows = 6 rows
    expect(rows.length).toBe(6);
  });

  it('should render custom count of skeleton rows', () => {
    render(<TableSkeleton count={3} />);
    const rows = screen.getAllByRole('row');
    // 1 header row + 3 body rows = 4 rows
    expect(rows.length).toBe(4);
  });

  it('should render header cells', () => {
    render(<TableSkeleton />);
    const headerCells = screen.getAllByRole('columnheader');
    expect(headerCells.length).toBeGreaterThan(0);
  });
});
