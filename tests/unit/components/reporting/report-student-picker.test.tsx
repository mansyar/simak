import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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

function searchInput() {
  return screen.getByLabelText('reports.student.searchLabel');
}

async function openListbox() {
  const user = userEvent.setup();
  await user.click(searchInput());
  return user;
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
    await user.click(searchInput());

    expect(await screen.findByRole('option', { name: /Alice/ })).toBeDefined();
    expect(listUsers).toHaveBeenCalledTimes(2);
  });

  it('shows an empty state when no students exist', async () => {
    vi.mocked(listUsers).mockResolvedValue({ users: [], total: 0 });
    renderWithQuery(<ReportStudentPicker value={null} onChange={vi.fn()} />);

    expect(await screen.findByText('reports.student.empty')).toBeDefined();
  });

  it('searches students server-side with a debounced term', async () => {
    vi.mocked(listUsers).mockResolvedValue({ users: students, total: 2 });
    renderWithQuery(<ReportStudentPicker value={null} onChange={vi.fn()} />);

    const user = await openListbox();
    await user.type(searchInput(), 'bob');

    await waitFor(() => {
      expect(listUsers).toHaveBeenLastCalledWith({
        data: { page: 1, limit: 20, search: 'bob', role: 'student' },
      });
    });
  });

  it('shows a no-results message when the server returns no matches', async () => {
    vi.mocked(listUsers).mockResolvedValue({ users: [], total: 0 });
    renderWithQuery(<ReportStudentPicker value={null} onChange={vi.fn()} />);

    const user = await openListbox();
    await user.type(searchInput(), 'zzz');

    expect(await screen.findByText('reports.student.noResults')).toBeDefined();
  });

  it('navigates options with arrow keys using active descendant semantics', async () => {
    vi.mocked(listUsers).mockResolvedValue({ users: students, total: 2 });
    renderWithQuery(<ReportStudentPicker value={null} onChange={vi.fn()} />);

    const user = await openListbox();
    const options = await screen.findAllByRole('option');

    await user.keyboard('{ArrowDown}');
    let active = document.getElementById(searchInput().getAttribute('aria-activedescendant')!);
    expect(active).toBe(options[0]);
    expect(searchInput()).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{ArrowDown}');
    active = document.getElementById(searchInput().getAttribute('aria-activedescendant')!);
    expect(active).toBe(options[1]);

    await user.keyboard('{ArrowUp}');
    active = document.getElementById(searchInput().getAttribute('aria-activedescendant')!);
    expect(active).toBe(options[0]);
  });

  it('moves to the first and last options with Home and End', async () => {
    vi.mocked(listUsers).mockResolvedValue({ users: students, total: 2 });
    renderWithQuery(<ReportStudentPicker value={null} onChange={vi.fn()} />);

    const user = await openListbox();
    const options = await screen.findAllByRole('option');

    await user.keyboard('{End}');
    let active = document.getElementById(searchInput().getAttribute('aria-activedescendant')!);
    expect(active).toBe(options[1]);

    await user.keyboard('{Home}');
    active = document.getElementById(searchInput().getAttribute('aria-activedescendant')!);
    expect(active).toBe(options[0]);
  });

  it('selects the active option with Enter and closes the listbox', async () => {
    const onChange = vi.fn();
    vi.mocked(listUsers).mockResolvedValue({ users: students, total: 2 });
    renderWithQuery(<ReportStudentPicker value={null} onChange={onChange} />);

    const user = await openListbox();
    await screen.findAllByRole('option');

    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith('student-1');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes the listbox with Escape without selecting', async () => {
    const onChange = vi.fn();
    vi.mocked(listUsers).mockResolvedValue({ users: students, total: 2 });
    renderWithQuery(<ReportStudentPicker value={null} onChange={onChange} />);

    const user = await openListbox();
    await screen.findAllByRole('option');

    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Escape}');

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(searchInput()).toHaveAttribute('aria-expanded', 'false');
  });

  it('selects an option on click', async () => {
    const onChange = vi.fn();
    vi.mocked(listUsers).mockResolvedValue({ users: students, total: 2 });
    renderWithQuery(<ReportStudentPicker value={null} onChange={onChange} />);

    const user = await openListbox();
    await user.click(await screen.findByRole('option', { name: /Bob/ }));

    expect(onChange).toHaveBeenCalledWith('student-2');
  });

  it('exposes options as listbox options rather than buttons', async () => {
    vi.mocked(listUsers).mockResolvedValue({ users: students, total: 2 });
    renderWithQuery(<ReportStudentPicker value={null} onChange={vi.fn()} />);

    await openListbox();
    const listbox = await screen.findByRole('listbox');

    expect(within(listbox).queryAllByRole('button')).toHaveLength(0);
    expect(within(listbox).getAllByRole('option').length).toBe(2);
  });

  it('accumulates loaded pages without duplicates until all results are shown', async () => {
    const user = userEvent.setup();
    const page1 = Array.from({ length: 20 }, (_, index) => ({
      ...students[0],
      id: `student-${index}`,
      name: `Student ${index}`,
      email: `student${index}@example.com`,
    }));
    const page2 = Array.from({ length: 15 }, (_, index) => ({
      ...students[0],
      id: `student-${index + 20}`,
      name: `Student ${index + 20}`,
      email: `student${index + 20}@example.com`,
    }));
    vi.mocked(listUsers).mockImplementation(async ({ data }) =>
      data.page === 1 ? { users: page1, total: 35 } : { users: page2, total: 35 },
    );
    renderWithQuery(<ReportStudentPicker value={null} onChange={vi.fn()} />);

    await openListbox();
    await screen.findByRole('option', { name: /Student 0/ });
    expect(screen.getByRole('button', { name: 'reports.student.loadMore' })).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'reports.student.loadMore' }));

    await waitFor(() => {
      expect(listUsers).toHaveBeenLastCalledWith({
        data: { page: 2, limit: 20, search: '', role: 'student' },
      });
    });
    await waitFor(() => {
      expect(screen.getAllByRole('option')).toHaveLength(35);
    });
    expect(screen.getByRole('option', { name: /Student 0/ })).toBeDefined();
    expect(screen.getByRole('option', { name: /Student 34/ })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'reports.student.loadMore' })).toBeNull();
  });

  it('resets accumulated pages when the search term changes', async () => {
    const user = userEvent.setup();
    const page1 = Array.from({ length: 20 }, (_, index) => ({
      ...students[0],
      id: `student-${index}`,
      name: `Student ${index}`,
      email: `student${index}@example.com`,
    }));
    vi.mocked(listUsers).mockImplementation(async ({ data }) => {
      if (data.search !== '') {
        return {
          users: [{ ...students[0], id: 'student-99', name: 'Zelda', email: 'zelda@example.com' }],
          total: 1,
        };
      }
      return data.page === 1 ? { users: page1, total: 35 } : { users: [], total: 35 };
    });
    renderWithQuery(<ReportStudentPicker value={null} onChange={vi.fn()} />);

    await openListbox();
    await screen.findByRole('option', { name: /Student 0/ });
    await user.click(screen.getByRole('button', { name: 'reports.student.loadMore' }));
    await waitFor(() => {
      expect(screen.getAllByRole('option')).toHaveLength(20);
    });

    await user.type(searchInput(), 'zelda');

    await waitFor(() => {
      expect(listUsers).toHaveBeenLastCalledWith({
        data: { page: 1, limit: 20, search: 'zelda', role: 'student' },
      });
    });
    expect(await screen.findByRole('option', { name: /Zelda/ })).toBeDefined();
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'reports.student.loadMore' })).toBeNull();
  });

  it('hides the load-more button once all results are shown', async () => {
    vi.mocked(listUsers).mockResolvedValue({ users: students, total: 2 });
    renderWithQuery(<ReportStudentPicker value={null} onChange={vi.fn()} />);

    await openListbox();
    await screen.findAllByRole('option');

    expect(screen.queryByRole('button', { name: 'reports.student.loadMore' })).toBeNull();
  });

  it('marks the selected student option', async () => {
    vi.mocked(listUsers).mockResolvedValue({ users: students, total: 2 });
    renderWithQuery(<ReportStudentPicker value="student-1" onChange={vi.fn()} />);

    await openListbox();
    const alice = await screen.findByRole('option', { name: /Alice/ });
    expect(alice).toHaveAttribute('aria-selected', 'true');
  });
});
