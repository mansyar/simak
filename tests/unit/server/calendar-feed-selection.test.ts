/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import {
  buildAppointmentFeedEvents,
  buildCalendarFeedEvents,
  type CalendarAppointmentRow,
  type CalendarFeedRow,
} from '@/server/calendar-feed-selection.server';

const studentId = 'student-1';

function row(overrides: Partial<CalendarFeedRow> = {}): CalendarFeedRow {
  return {
    assignmentId: 1,
    assignmentTitle: 'Research Project',
    assignmentFinalDeadline: new Date('2026-08-10T12:00:00.000Z'),
    assignmentDeletedAt: null,
    checkpointId: 11,
    checkpointName: 'Proposal',
    assignmentStudentId: studentId,
    checkpointStudentId: studentId,
    checkpointState: 'unlocked',
    checkpointDueDate: new Date('2026-08-05T12:00:00.000Z'),
    ...overrides,
  };
}

const appointmentNow = new Date('2026-08-08T12:00:00.000Z');

function appointmentRow(overrides: Partial<CalendarAppointmentRow> = {}): CalendarAppointmentRow {
  return {
    appointmentId: 401,
    assignmentId: 10,
    assignmentTitle: 'Research Project',
    assignmentStatus: 'active',
    assignmentDeletedAt: null,
    checkpointId: 11,
    checkpointName: 'Proposal',
    studentId,
    status: 'booked',
    startAt: new Date('2026-08-09T12:00:00.000Z'),
    endAt: new Date('2026-08-09T13:00:00.000Z'),
    ...overrides,
  };
}

describe('buildCalendarFeedEvents', () => {
  it('includes only the selected student active-assignment checkpoints', () => {
    const events = buildCalendarFeedEvents(
      [
        row(),
        row({
          assignmentId: 2,
          checkpointId: 21,
          assignmentStudentId: 'student-2',
          checkpointStudentId: 'student-2',
        }),
        row({
          assignmentId: 3,
          checkpointId: 31,
          assignmentDeletedAt: new Date('2026-07-01T00:00:00.000Z'),
        }),
      ],
      studentId,
    );

    expect(events.map((event) => event.uid)).toEqual([
      'checkpoint-11@simak',
      'assignment-final-1@simak',
    ]);
  });

  it('includes locked future and overdue non-passed checkpoints but omits passed/null-due checkpoints', () => {
    const events = buildCalendarFeedEvents(
      [
        row({ checkpointId: 11, checkpointState: 'locked' }),
        row({
          checkpointId: 12,
          checkpointName: 'Overdue',
          checkpointState: 'revise',
          checkpointDueDate: new Date('2020-01-01T00:00:00.000Z'),
        }),
        row({ checkpointId: 13, checkpointState: 'passed' }),
        row({ checkpointId: 14, checkpointDueDate: null }),
      ],
      studentId,
    );

    expect(events.filter((event) => event.kind === 'checkpoint')).toHaveLength(2);
    expect(events.map((event) => event.uid)).toContain('checkpoint-11@simak');
    expect(events.map((event) => event.uid)).toContain('checkpoint-12@simak');
    expect(events.map((event) => event.uid)).not.toContain('checkpoint-13@simak');
    expect(events.map((event) => event.uid)).not.toContain('checkpoint-14@simak');
  });

  it('adds one assignment final event only when an active assignment has an unresolved checkpoint', () => {
    const events = buildCalendarFeedEvents(
      [
        row({ assignmentId: 1, checkpointId: 11, checkpointState: 'under_review' }),
        row({ assignmentId: 1, checkpointId: 12, checkpointState: 'locked' }),
        row({ assignmentId: 2, checkpointId: 21, checkpointState: 'passed' }),
      ],
      studentId,
    );

    expect(events.filter((event) => event.kind === 'assignment-final')).toHaveLength(1);
    expect(events.find((event) => event.kind === 'assignment-final')).toMatchObject({
      uid: 'assignment-final-1@simak',
      startsAt: new Date('2026-08-10T12:00:00.000Z'),
    });
  });

  it('adds a final event when an unresolved checkpoint has no due date', () => {
    const events = buildCalendarFeedEvents(
      [row({ checkpointDueDate: null, checkpointState: 'locked' })],
      studentId,
    );

    expect(events).toEqual([
      {
        uid: 'assignment-final-1@simak',
        kind: 'assignment-final',
        summary: 'Research Project — Final deadline',
        startsAt: new Date('2026-08-10T12:00:00.000Z'),
      },
    ]);
  });

  it('keeps IDs stable when dates change and removes passed checkpoints on refresh', () => {
    const initial = buildCalendarFeedEvents([row()], studentId);
    const changed = buildCalendarFeedEvents(
      [
        row({
          checkpointDueDate: new Date('2026-08-06T12:00:00.000Z'),
        }),
      ],
      studentId,
    );
    const passed = buildCalendarFeedEvents([row({ checkpointState: 'passed' })], studentId);

    expect(changed[0]?.uid).toBe(initial[0]?.uid);
    expect(changed[0]?.startsAt).not.toEqual(initial[0]?.startsAt);
    expect(passed.map((event) => event.uid)).not.toContain('checkpoint-11@simak');
    expect(passed.map((event) => event.uid)).not.toContain('assignment-final-1@simak');
  });
});

describe('buildAppointmentFeedEvents', () => {
  it('includes only future booked appointments for the active selected assignment student', () => {
    const events = buildAppointmentFeedEvents(
      [
        appointmentRow(),
        appointmentRow({
          appointmentId: 402,
          checkpointId: null,
          checkpointName: null,
          startAt: new Date('2026-08-10T12:00:00.000Z'),
          endAt: new Date('2026-08-10T13:00:00.000Z'),
        }),
        appointmentRow({ appointmentId: 403, status: 'available' }),
        appointmentRow({ appointmentId: 404, status: 'cancelled' }),
        appointmentRow({
          appointmentId: 405,
          startAt: new Date('2026-08-08T11:59:59.000Z'),
          endAt: new Date('2026-08-08T12:59:59.000Z'),
        }),
        appointmentRow({ appointmentId: 406, studentId: 'student-2' }),
        appointmentRow({ appointmentId: 407, assignmentStatus: 'draft' }),
        appointmentRow({
          appointmentId: 408,
          assignmentDeletedAt: new Date('2026-08-01T00:00:00.000Z'),
        }),
      ],
      studentId,
      appointmentNow,
    );

    expect(events).toEqual([
      {
        uid: 'appointment-401@simak',
        kind: 'appointment',
        summary: 'Research Project — Proposal',
        startsAt: new Date('2026-08-09T12:00:00.000Z'),
        endsAt: new Date('2026-08-09T13:00:00.000Z'),
      },
      {
        uid: 'appointment-402@simak',
        kind: 'appointment',
        summary: 'Research Project — Advising appointment',
        startsAt: new Date('2026-08-10T12:00:00.000Z'),
        endsAt: new Date('2026-08-10T13:00:00.000Z'),
      },
    ]);
  });

  it('keeps the appointment UID stable when a booked appointment is rescheduled', () => {
    const initial = buildAppointmentFeedEvents([appointmentRow()], studentId, appointmentNow);
    const changed = buildAppointmentFeedEvents(
      [
        appointmentRow({
          startAt: new Date('2026-08-09T14:00:00.000Z'),
          endAt: new Date('2026-08-09T15:00:00.000Z'),
        }),
      ],
      studentId,
      appointmentNow,
    );

    expect(changed[0]?.uid).toBe(initial[0]?.uid);
    expect(changed[0]?.startsAt).not.toEqual(initial[0]?.startsAt);
    expect(changed[0]?.endsAt).not.toEqual(initial[0]?.endsAt);
  });
});
