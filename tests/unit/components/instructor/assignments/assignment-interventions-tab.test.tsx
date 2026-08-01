/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, render, waitFor, within } from '@testing-library/react';

const mockListInterventions = vi.fn();
const mockGetInterventionContext = vi.fn();

vi.mock('@/server/interventions', () => ({
  listInterventions: (...args: unknown[]) => mockListInterventions(...args),
  getInterventionContext: (...args: unknown[]) => mockGetInterventionContext(...args),
}));

vi.mock('@/routes/__root', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const students = [
  { id: 'student-1', name: 'Alice', email: 'alice@example.com' },
  { id: 'student-2', name: 'Bob', email: 'bob@example.com' },
];

describe('AssignmentInterventionsTab', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockListInterventions.mockResolvedValue({
      interventions: [
        {
          id: 10,
          assignmentId: 7,
          studentId: 'student-1',
          studentName: 'Alice',
          assignmentTitle: 'Research paper',
          actionType: 'consultation',
          status: 'open',
          privateNote: 'Invite to consultation',
          followUpDate: null,
          resolutionReason: null,
          createdAt: new Date('2026-08-01T00:00:00.000Z'),
          updatedAt: new Date('2026-08-01T00:00:00.000Z'),
        },
        {
          id: 11,
          assignmentId: 7,
          studentId: 'student-2',
          studentName: 'Bob',
          assignmentTitle: 'Research paper',
          actionType: 'discussion',
          status: 'resolved',
          privateNote: 'Past intervention',
          followUpDate: null,
          resolutionReason: 'Student re-engaged',
          createdAt: new Date('2026-07-01T00:00:00.000Z'),
          updatedAt: new Date('2026-07-10T00:00:00.000Z'),
        },
      ],
      total: 2,
      page: 1,
      limit: 100,
    });
    mockGetInterventionContext.mockImplementation(({ data }: { data: { studentId: string } }) =>
      Promise.resolve({
        context: {
          studentId: data.studentId,
          studentName: data.studentId === 'student-1' ? 'Alice' : 'Bob',
          assignmentId: 7,
          assignmentTitle: 'Research paper',
          checkpoints: [],
          assessment: {
            level: 'high',
            factors: [
              {
                type: data.studentId === 'student-2' ? 'repeated_revise' : 'overdue_checkpoint',
                severity: data.studentId === 'student-2' ? 'medium' : 'high',
                category: 'student_inaction',
                checkpointId: 3,
                description: 'Checkpoint is overdue',
              },
            ],
          },
        },
      }),
    );
  });

  it('loads intervention records and live context for every assignment student', async () => {
    const { AssignmentInterventionsTab } =
      await import('@/components/instructor/assignments/AssignmentInterventionsTab');

    const { getByText } = render(
      <AssignmentInterventionsTab assignmentId={7} students={students} />,
    );

    await waitFor(() => expect(getByText('Alice', { selector: 'h3' })).toBeTruthy());
    expect(getByText('Bob', { selector: 'h3' })).toBeTruthy();
    expect(mockListInterventions).toHaveBeenCalledWith({
      data: { assignmentId: 7, page: 1, limit: 100 },
    });
    expect(mockGetInterventionContext).toHaveBeenCalledTimes(2);
  });

  it('offers manage and create links while preserving the student context', async () => {
    const { AssignmentInterventionsTab } =
      await import('@/components/instructor/assignments/AssignmentInterventionsTab');

    const { getAllByRole, getByRole, getByTestId, queryByTestId } = render(
      <AssignmentInterventionsTab assignmentId={7} students={students} />,
    );

    await waitFor(() => expect(getByTestId('manage-intervention-student-1')).toBeTruthy());
    expect(getByTestId('create-intervention-student-2')).toBeTruthy();
    expect(queryByTestId('manage-intervention-student-2')).toBeNull();
    expect(getByTestId('manage-intervention-student-1').getAttribute('href')).toContain(
      'studentId=student-1',
    );
    expect(getByTestId('create-intervention-student-2').getAttribute('href')).toContain(
      'studentId=student-2',
    );
    expect(
      within(getAllByRole('list', { name: 'instructorInterventions.listLabel' })[0])
        .getByRole('link', { name: 'instructorInterventions.manage' })
        .getAttribute('href'),
    ).toContain('studentId=student-1');
  });
});
