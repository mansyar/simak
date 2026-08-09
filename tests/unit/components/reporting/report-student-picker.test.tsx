import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'en', setLocale: vi.fn() }),
}));

vi.mock('@/server/users', () => ({
  listUsers: vi.fn(),
}));

import { ReportStudentPicker } from '@/components/reporting/ReportStudentPicker';
import { listUsers } from '@/server/users';

const students = [
  {
    id: 'student-1',
    name: 'Alice',
    email: 'alice@example.com',
    role: 'student' as const,
    locale: null,
    emailVerified: false,
    createdAt: new Date(),
    deletedAt: null,
  },
  {
    id: 'student-2',
    name: 'Bob',
    email: 'bob@example.com',
    role: 'student' as const,
    locale: null,
    emailVerified: false,
    createdAt: new Date(),
    deletedAt: null,
  },
];

function renderWithQuery(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('ReportStudentPicker', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows a loading state while students load', () => {
    vi.mocked(listUsers).mockReturnValue(new Promise(() => {}));
    renderWithQuery(<ReportStudentPicker value={null} onChange={vi.fn()} />);

    expect(screen.getByText('reports.student.loading')).toBeDefined();
  });

  it('shows an error state and retries loading students', async () => {
    const user = userEvent.setup();
    vi.mocked(listUsers)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ users: students, total: 2 });
    renderWithQuery(<ReportStudentPicker value={null} onChange={vi.fn()} />);

    expect(await screen.findByText('reports.student.loadError')).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'common.retry' }));

    expect(await screen.findByRole('option', { name: /Alice/ })).toBeDefined();
    expect(listUsers).toHaveBeenCalledTimes(2);
  });

  it('shows an empty state when no students exist', async () => {
    vi.mocked(listUsers).mockResolvedValue({ users: [], total: 0 });
    renderWithQuery(<ReportStudentPicker value={null} onChange={vi.fn()} />);

    expect(await screen.findByText('reports.student.empty')).toBeDefined();
  });

  it('filters students by the search term and notifies selection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    vi.mocked(listUsers).mockResolvedValue({ users: students, total: 2 });
    renderWithQuery(<ReportStudentPicker value={null} onChange={onChange} />);

    await screen.findByRole('option', { name: /Alice/ });

    await user.type(screen.getByLabelText('reports.student.searchLabel'), 'bob');
    expect(screen.queryByRole('option', { name: /Alice/ })).toBeNull();
    expect(screen.getByRole('option', { name: /Bob/ })).toBeDefined();

    await user.click(screen.getByRole('option', { name: /Bob/ }));
    expect(onChange).toHaveBeenCalledWith('student-2');
  });

  it('shows a no-results message when the search matches nothing', async () => {
    const user = userEvent.setup();
    vi.mocked(listUsers).mockResolvedValue({ users: students, total: 2 });
    renderWithQuery(<ReportStudentPicker value={null} onChange={vi.fn()} />);

    await screen.findByRole('option', { name: /Alice/ });
    await user.type(screen.getByLabelText('reports.student.searchLabel'), 'zzz');

    expect(screen.getByText('reports.student.noResults')).toBeDefined();
  });

  it('marks the selected student option', async () => {
    vi.mocked(listUsers).mockResolvedValue({ users: students, total: 2 });
    renderWithQuery(<ReportStudentPicker value="student-1" onChange={vi.fn()} />);

    const alice = await screen.findByRole('option', { name: /Alice/ });
    expect(alice).toHaveAttribute('aria-selected', 'true');
  });
});
