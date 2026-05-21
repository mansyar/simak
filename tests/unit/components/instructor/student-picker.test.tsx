import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StudentPicker } from '@/components/instructor/assignments/StudentPicker';
import * as usersApi from '@/server/users';

vi.mock('@/server/users', () => ({
  listUsers: vi.fn(),
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string, params?: any) => {
      const translations: Record<string, string> = {
        'instructorAssignments.wizard.stepStudents': 'Assign Students',
        'instructorAssignments.wizard.selectStudentsPrompt':
          'Assign this cohort assignment to one or more students',
        'instructorAssignments.wizard.selectedStudents': '{count} students selected',
        'instructorAssignments.wizard.noStudentsSelected': 'No students selected yet',
        'instructorAssignments.wizard.searchStudents': 'Search students by name or email...',
      };
      let text = translations[key] || key;
      if (params) {
        Object.keys(params).forEach((p) => {
          text = text.replace(`{${p}}`, params[p]);
        });
      }
      return text;
    },
  }),
}));

describe('StudentPicker', () => {
  const mockStudents = [
    { id: 'student-1', name: 'Alice Cooper', email: 'alice@test.com' },
    { id: 'student-2', name: 'Bob Marley', email: 'bob@test.com' },
  ];

  const onToggleStudent = vi.fn();
  const onSelectAll = vi.fn();
  const onDeselectAll = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersApi.listUsers).mockResolvedValue({
      users: mockStudents,
      total: 2,
    } as any);
  });

  it('should render and display students list', async () => {
    render(
      <StudentPicker
        selectedStudentIds={[]}
        onToggleStudent={onToggleStudent}
        onSelectAll={onSelectAll}
        onDeselectAll={onDeselectAll}
        errors={{}}
      />,
    );

    expect(screen.getByText('Assign Students')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Alice Cooper')).toBeDefined();
      expect(screen.getByText('Bob Marley')).toBeDefined();
    });
  });

  it('should trigger onToggleStudent callback when student clicked', async () => {
    render(
      <StudentPicker
        selectedStudentIds={[]}
        onToggleStudent={onToggleStudent}
        onSelectAll={onSelectAll}
        onDeselectAll={onDeselectAll}
        errors={{}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Alice Cooper')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Alice Cooper'));
    expect(onToggleStudent).toHaveBeenCalledWith('student-1');
  });

  it('should filter list using search field', async () => {
    render(
      <StudentPicker
        selectedStudentIds={[]}
        onToggleStudent={onToggleStudent}
        onSelectAll={onSelectAll}
        onDeselectAll={onDeselectAll}
        errors={{}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Alice Cooper')).toBeDefined();
    });

    const searchInput = screen.getByPlaceholderText('Search students by name or email...');
    fireEvent.change(searchInput, { target: { value: 'bob' } });

    expect(screen.queryByText('Alice Cooper')).toBeNull();
    expect(screen.getByText('Bob Marley')).toBeDefined();
  });

  it('should support select all toggle function', async () => {
    render(
      <StudentPicker
        selectedStudentIds={[]}
        onToggleStudent={onToggleStudent}
        onSelectAll={onSelectAll}
        onDeselectAll={onDeselectAll}
        errors={{}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Select All')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Select All'));
    expect(onSelectAll).toHaveBeenCalledWith(['student-1', 'student-2']);
  });

  it('should render validation errors if present', () => {
    render(
      <StudentPicker
        selectedStudentIds={[]}
        onToggleStudent={onToggleStudent}
        onSelectAll={onSelectAll}
        onDeselectAll={onDeselectAll}
        errors={{ studentIds: 'At least one student is required' }}
      />,
    );

    expect(screen.getByText('At least one student is required')).toBeDefined();
  });
});
