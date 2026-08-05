/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { ComponentType } from 'react';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: { page: 1, limit: 50, action: '', dateFrom: '', dateTo: '', search: '' },
  loaderData: { entries: [], total: 0 },
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: any) => ({
    ...config,
    useLoaderData: () => mocks.loaderData,
    useSearch: () => mocks.search,
    useNavigate: () => mocks.navigate,
  }),
  useRouter: () => ({ invalidate: vi.fn() }),
}));

vi.mock('@/server/audit-log', () => ({
  listAuditLogs: vi.fn(),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input data-testid="search-input" {...props} />,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/table', () => ({
  Table: ({ children, ...props }: any) => <table {...props}>{children}</table>,
  TableBody: ({ children, ...props }: any) => <tbody {...props}>{children}</tbody>,
  TableCaption: ({ children, ...props }: any) => <caption {...props}>{children}</caption>,
  TableCell: ({ children, ...props }: any) => <td {...props}>{children}</td>,
  TableHead: ({ children, ...props }: any) => <th {...props}>{children}</th>,
  TableHeader: ({ children, ...props }: any) => <thead {...props}>{children}</thead>,
  TableRow: ({ children, ...props }: any) => <tr {...props}>{children}</tr>,
}));

vi.mock('@/components/ui/page-header', () => ({
  PageHeader: () => <div data-testid="page-header" />,
}));

vi.mock('@/components/ui/refresh-button', () => ({
  RefreshButton: () => <button data-testid="refresh-button" />,
}));

vi.mock('@/components/ui/pagination', () => ({
  Pagination: () => <div data-testid="pagination" />,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: any) => <div data-testid="select">{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => <span />,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/skeletons/table-skeleton', () => ({
  TableSkeleton: () => <div data-testid="table-skeleton" />,
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'en',
  }),
}));

vi.mock('@/lib/admin/audit-actions', () => ({
  getActionVisualProps: () => ({ badgeVariant: 'default' }),
  ACTION_TYPES: [],
}));

vi.mock('@/lib/format-date', () => ({
  formatDate: () => '2024-01-01',
}));

vi.mock('@/lib/errors', () => ({
  isServerError: () => false,
}));

import { Route } from '@/routes/_authenticated/admin/audit-log';

const AuditLogPage = (Route as any).component as ComponentType;

describe('AuditLogPage - search debounce & clear', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.search = { page: 1, limit: 50, action: '', dateFrom: '', dateTo: '', search: '' };
    mocks.loaderData = { entries: [], total: 0 };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should debounce navigate - rapid typing fires only 1 call after delay', () => {
    render(<AuditLogPage />);

    const searchInput = screen.getByPlaceholderText('adminAuditLog.searchPlaceholder');

    const word = 'algorithm';
    for (let i = 1; i <= word.length; i++) {
      fireEvent.change(searchInput, { target: { value: word.slice(0, i) } });
    }

    expect(mocks.navigate).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(mocks.navigate).toHaveBeenCalledTimes(1);
  });

  it('should show X clear button when search is not empty', () => {
    mocks.search = { ...mocks.search, search: 'test' };
    render(<AuditLogPage />);

    expect(screen.getByLabelText('common.clearSearch')).toBeDefined();
  });

  it('should hide X clear button when search is empty', () => {
    render(<AuditLogPage />);

    expect(screen.queryByLabelText('common.clearSearch')).toBeNull();
  });

  it('should clear search immediately when X button is clicked', () => {
    mocks.search = { ...mocks.search, search: 'test' };
    render(<AuditLogPage />);

    fireEvent.click(screen.getByLabelText('common.clearSearch'));

    expect(mocks.navigate).toHaveBeenCalledTimes(1);
    const call = mocks.navigate.mock.calls[0][0];
    const result = call.search({
      page: 1,
      limit: 50,
      action: '',
      dateFrom: '',
      dateTo: '',
      search: 'test',
    });
    expect(result.search).toBe('');
    expect(result.page).toBe(1);
  });
});
