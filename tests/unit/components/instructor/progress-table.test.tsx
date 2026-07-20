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
    expect(screen.getByText('Alice Cooper')).toBeDefined();
    expect(screen.getAllByText('alice@test.com').length).toBeGreaterThan(0);
    expect(screen.getByText('50%')).toBeDefined();
    expect(screen.getByText('Draft Proposal')).toBeDefined();

    expect(screen.getByText('Bob Marley')).toBeDefined();
    expect(screen.getAllByText('bob@test.com').length).toBeGreaterThan(0);
    expect(screen.getByText('100%')).toBeDefined();
  });

  it('should display active checkpoint state badge or completed badge', () => {
    render(<ProgressTable students={mockStudents as any} />);
    expect(screen.getByText('Unlocked')).toBeDefined();
    expect(screen.getByText('Passed')).toBeDefined();
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
    expect(progressbars.length).toBe(2);
  });

  it('progress bars have aria-valuenow matching progressPercent', () => {
    render(<ProgressTable students={mockStudents as any} />);
    const progressbars = screen.getAllByRole('progressbar');
    expect(progressbars[0].getAttribute('aria-valuenow')).toBe('50');
    expect(progressbars[1].getAttribute('aria-valuenow')).toBe('100');
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
