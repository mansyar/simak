import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressTable } from '@/components/instructor/assignments/ProgressTable';

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string, params?: any) => {
      const translations: Record<string, string> = {
        'instructorAssignments.table.student': 'Student',
        'instructorAssignments.table.email': 'Email',
        'instructorAssignments.table.progress': 'Progress',
        'instructorAssignments.table.activeCheckpoint': 'Active Checkpoint',
        'instructorAssignments.status.passed': 'Passed',
        'instructorAssignments.status.unlocked': 'Unlocked',
        'instructorAssignments.status.locked': 'Locked',
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

describe('ProgressTable', () => {
  const mockStudents = [
    {
      id: 'student-1',
      name: 'Alice Cooper',
      email: 'alice@test.com',
      progressPercent: 50,
      passedCount: 1,
      totalCheckpointsCount: 2,
      activeCheckpoint: {
        id: 102,
        name: 'Draft Proposal',
        state: 'unlocked',
      },
    },
    {
      id: 'student-2',
      name: 'Bob Marley',
      email: 'bob@test.com',
      progressPercent: 100,
      passedCount: 2,
      totalCheckpointsCount: 2,
      activeCheckpoint: null, // finished all checkpoints
    },
  ];

  it('should render table headers', () => {
    render(<ProgressTable students={mockStudents as any} />);
    expect(screen.getByText('Student')).toBeDefined();
    expect(screen.getByText('Email')).toBeDefined();
    expect(screen.getByText('Progress')).toBeDefined();
    expect(screen.getByText('Active Checkpoint')).toBeDefined();
  });

  it('should render student rows', () => {
    render(<ProgressTable students={mockStudents as any} />);
    expect(screen.getAllByText('Alice Cooper').length).toBe(2);
    expect(screen.getAllByText('alice@test.com').length).toBeGreaterThan(0);
    expect(screen.getAllByText('50%').length).toBe(2);
    expect(screen.getAllByText('Draft Proposal').length).toBe(2);

    expect(screen.getAllByText('Bob Marley').length).toBe(2);
    expect(screen.getAllByText('bob@test.com').length).toBeGreaterThan(0);
    expect(screen.getAllByText('100%').length).toBe(2);
  });

  it('should display active checkpoint state badge or completed badge', () => {
    render(<ProgressTable students={mockStudents as any} />);
    expect(screen.getAllByText('Unlocked').length).toBe(2);
    expect(screen.getAllByText('Passed').length).toBe(2);
  });
});

describe('ProgressTable - progressbar ARIA attributes (UX-21)', () => {
  const mockStudents = [
    {
      id: 'student-1',
      name: 'Alice Cooper',
      email: 'alice@test.com',
      progressPercent: 50,
      passedCount: 1,
      totalCheckpointsCount: 2,
      activeCheckpoint: { id: 102, name: 'Draft Proposal', state: 'unlocked' },
    },
    {
      id: 'student-2',
      name: 'Bob Marley',
      email: 'bob@test.com',
      progressPercent: 100,
      passedCount: 2,
      totalCheckpointsCount: 2,
      activeCheckpoint: null,
    },
  ];

  it('renders progress bar containers with role="progressbar"', () => {
    render(<ProgressTable students={mockStudents as any} />);
    const progressbars = screen.getAllByRole('progressbar');
    expect(progressbars.length).toBe(4);
  });

  it('progress bars have aria-valuenow matching progressPercent', () => {
    render(<ProgressTable students={mockStudents as any} />);
    const progressbars = screen.getAllByRole('progressbar');
    const values = progressbars.map((b) => b.getAttribute('aria-valuenow'));
    expect(values).toContain('50');
    expect(values).toContain('100');
  });

  it('progress bars have aria-valuemin=0 and aria-valuemax=100', () => {
    render(<ProgressTable students={mockStudents as any} />);
    const progressbars = screen.getAllByRole('progressbar');
    for (const bar of progressbars) {
      expect(bar.getAttribute('aria-valuemin')).toBe('0');
      expect(bar.getAttribute('aria-valuemax')).toBe('100');
    }
  });

  it('progress bars have aria-label from t("instructorAssignments.table.progress")', () => {
    render(<ProgressTable students={mockStudents as any} />);
    const progressbars = screen.getAllByRole('progressbar');
    for (const bar of progressbars) {
      expect(bar.getAttribute('aria-label')).toBe('Progress');
    }
  });
});

describe('ProgressTable - Mobile Card Layout (UX-36)', () => {
  const mockStudents = [
    {
      id: 'student-1',
      name: 'Alice Cooper',
      email: 'alice@test.com',
      progressPercent: 50,
      passedCount: 1,
      totalCheckpointsCount: 2,
      activeCheckpoint: { id: 102, name: 'Draft Proposal', state: 'unlocked' },
    },
    {
      id: 'student-2',
      name: 'Bob Marley',
      email: 'bob@test.com',
      progressPercent: 100,
      passedCount: 2,
      totalCheckpointsCount: 2,
      activeCheckpoint: null,
    },
  ];

  it('should render desktop table hidden on mobile (hidden sm:block)', () => {
    render(<ProgressTable students={mockStudents as any} />);
    const desktop = screen.getByTestId('desktop-progress-table');
    expect(desktop.className).toMatch(/\bhidden\b/);
    expect(desktop.className).toMatch(/\bsm:block\b/);
  });

  it('should render mobile cards container visible only on mobile (sm:hidden)', () => {
    render(<ProgressTable students={mockStudents as any} />);
    const mobile = screen.getByTestId('mobile-progress-cards');
    expect(mobile.className).toMatch(/\bsm:hidden\b/);
  });

  it('should render one card per student in mobile layout', () => {
    render(<ProgressTable students={mockStudents as any} />);
    const mobile = screen.getByTestId('mobile-progress-cards');
    const cards = mobile.querySelectorAll('[data-testid="student-mobile-card"]');
    expect(cards.length).toBe(2);
  });

  it('should show student name and email in each mobile card', () => {
    render(<ProgressTable students={mockStudents as any} />);
    const mobile = screen.getByTestId('mobile-progress-cards');
    expect(mobile.textContent).toContain('Alice Cooper');
    expect(mobile.textContent).toContain('alice@test.com');
    expect(mobile.textContent).toContain('Bob Marley');
    expect(mobile.textContent).toContain('bob@test.com');
  });

  it('should show progress bar in mobile cards', () => {
    render(<ProgressTable students={mockStudents as any} />);
    const mobile = screen.getByTestId('mobile-progress-cards');
    const mobileBars = mobile.querySelectorAll('[role="progressbar"]');
    expect(mobileBars.length).toBe(2);
  });
});
