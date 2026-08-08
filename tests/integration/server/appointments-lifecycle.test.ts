/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/db/index';
import {
  academicTerms,
  assignmentStudents,
  assignmentTemplates,
  assignments,
  appointments,
  checkpoints,
  courseSections,
  users,
} from '@/db/schema';
import * as auth from '@/server/auth';
import { bookAppointmentHandler } from '@/server/appointments-lifecycle.server';
import { rescheduleAppointmentHandler } from '@/server/appointments-rescheduling.server';
import { completeAppointmentHandler } from '@/server/appointments-outcomes.server';
import {
  createAppointmentSlotHandler,
  listInstructorAppointmentsHandler,
} from '@/server/appointments.server';
import {
  createAcademicSectionFixture,
  deleteAcademicSectionFixture,
  type AcademicSectionFixture,
} from '../helpers/academic-context';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  safeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/appointment-notifications', () => ({
  notifyAppointmentParticipants: vi.fn().mockResolvedValue(undefined),
}));

type AppointmentFixture = {
  instructorId: string;
  studentId: string;
  academic: AcademicSectionFixture;
  templateId: number;
  assignmentId: number;
  unrelatedAssignmentId: number;
  checkpointId: number;
};

const db = getDb();
let fixture: AppointmentFixture;

function session(userId: string, role: 'instructor' | 'student') {
  return {
    user: { id: userId, name: `${role} appointment test`, role, email: `${userId}@test.com` },
    session: {},
  } as never;
}

async function createAppointment(
  assignmentId: number,
  instructorId: string,
  values: Partial<{
    studentId: string | null;
    checkpointId: number | null;
    startAt: Date;
    endAt: Date;
    status: 'available' | 'booked' | 'cancelled' | 'completed' | 'no_show';
  }> = {},
) {
  const startAt = values.startAt ?? new Date(Date.now() + 60 * 60 * 1000);
  const endAt = values.endAt ?? new Date(startAt.getTime() + 30 * 60 * 1000);
  const [appointment] = await db
    .insert(appointments)
    .values({
      assignmentId,
      instructorId,
      studentId: values.studentId,
      checkpointId: values.checkpointId,
      startAt,
      endAt,
      status: values.status ?? 'available',
    })
    .returning({ id: appointments.id });
  return appointment.id;
}

beforeEach(async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  fixture = {
    instructorId: `appointment-instructor-${suffix}`,
    studentId: `appointment-student-${suffix}`,
  } as AppointmentFixture;

  await db.insert(users).values([
    {
      id: fixture.instructorId,
      name: 'Appointment Integration Instructor',
      email: `${fixture.instructorId}@test.com`,
      role: 'instructor',
      locale: 'en',
    },
    {
      id: fixture.studentId,
      name: 'Appointment Integration Student',
      email: `${fixture.studentId}@test.com`,
      role: 'student',
      locale: 'en',
    },
  ]);

  fixture.academic = await createAcademicSectionFixture(
    db,
    `appointment-${suffix}`,
    fixture.instructorId,
    [fixture.studentId],
  );

  const [template] = await db
    .insert(assignmentTemplates)
    .values({
      name: `Appointment Integration Template ${suffix}`,
      type: 'Thesis',
      createdBy: fixture.instructorId,
    })
    .returning({ id: assignmentTemplates.id });
  fixture.templateId = template.id;

  const [assignment] = await db
    .insert(assignments)
    .values({
      templateId: fixture.templateId,
      title: `Appointment Assignment ${suffix}`,
      finalDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      instructorId: fixture.instructorId,
      sectionId: fixture.academic.sectionId,
      mode: 'individual',
      status: 'active',
    })
    .returning({ id: assignments.id });
  fixture.assignmentId = assignment.id;

  await db.insert(assignmentStudents).values({
    assignmentId: fixture.assignmentId,
    studentId: fixture.studentId,
  });

  const [checkpoint] = await db
    .insert(checkpoints)
    .values({
      assignmentId: fixture.assignmentId,
      studentId: fixture.studentId,
      name: 'Appointment Integration Checkpoint',
      order: 1,
      state: 'unlocked',
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })
    .returning({ id: checkpoints.id });
  fixture.checkpointId = checkpoint.id;

  const [unrelatedAssignment] = await db
    .insert(assignments)
    .values({
      templateId: fixture.templateId,
      title: `Unrelated Appointment Assignment ${suffix}`,
      finalDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      instructorId: fixture.instructorId,
      sectionId: fixture.academic.sectionId,
      mode: 'individual',
      status: 'active',
    })
    .returning({ id: assignments.id });
  fixture.unrelatedAssignmentId = unrelatedAssignment.id;
});

afterEach(async () => {
  if (!fixture?.academic) {
    return;
  }

  await db
    .delete(appointments)
    .where(
      inArray(appointments.assignmentId, [fixture.assignmentId, fixture.unrelatedAssignmentId]),
    );
  await db
    .delete(assignmentStudents)
    .where(
      inArray(assignmentStudents.assignmentId, [
        fixture.assignmentId,
        fixture.unrelatedAssignmentId,
      ]),
    );
  await db.delete(checkpoints).where(eq(checkpoints.id, fixture.checkpointId));
  await db
    .delete(assignments)
    .where(inArray(assignments.id, [fixture.assignmentId, fixture.unrelatedAssignmentId]));
  await db.delete(assignmentTemplates).where(eq(assignmentTemplates.id, fixture.templateId));
  await deleteAcademicSectionFixture(db, fixture.academic);
  await db.delete(users).where(inArray(users.id, [fixture.instructorId, fixture.studentId]));
});

describe('appointment PostgreSQL concurrency and authorization', () => {
  it('allows one concurrent booking winner and ignores cancelled overlaps', async () => {
    const startAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);
    const availableId = await createAppointment(fixture.assignmentId, fixture.instructorId, {
      startAt,
      endAt,
    });
    const cancelledId = await createAppointment(fixture.assignmentId, fixture.instructorId, {
      studentId: fixture.studentId,
      startAt,
      endAt,
      status: 'cancelled',
    });

    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(session(fixture.studentId, 'student'));
    const results = await Promise.all([
      bookAppointmentHandler({ data: { appointmentId: availableId } }),
      bookAppointmentHandler({ data: { appointmentId: availableId } }),
    ]);

    expect(results.filter((result) => 'appointment' in result)).toHaveLength(1);
    expect(results.filter((result) => 'error' in result)).toHaveLength(1);

    const [booked] = await db
      .select({ status: appointments.status, studentId: appointments.studentId })
      .from(appointments)
      .where(eq(appointments.id, availableId));
    const [cancelled] = await db
      .select({ status: appointments.status, studentId: appointments.studentId })
      .from(appointments)
      .where(eq(appointments.id, cancelledId));
    expect(booked).toEqual({ status: 'booked', studentId: fixture.studentId });
    expect(cancelled).toEqual({ status: 'cancelled', studentId: fixture.studentId });
  });

  it('allows only one concurrent overlapping slot for an instructor', async () => {
    const startAt = new Date(Date.now() + 5 * 60 * 60 * 1000);
    const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(
      session(fixture.instructorId, 'instructor'),
    );

    const results = await Promise.all([
      createAppointmentSlotHandler({
        data: { assignmentId: fixture.assignmentId, startAt, endAt },
      }),
      createAppointmentSlotHandler({
        data: { assignmentId: fixture.assignmentId, startAt, endAt },
      }),
    ]);

    expect(results.filter((result) => 'appointment' in result)).toHaveLength(1);
    expect(results.filter((result) => 'error' in result)).toHaveLength(1);

    const rows = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(eq(appointments.assignmentId, fixture.assignmentId));
    expect(rows).toHaveLength(1);
  });

  it('serializes concurrent rescheduling to the same replacement and preserves identity', async () => {
    const replacementStartAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
    const replacementEndAt = new Date(replacementStartAt.getTime() + 30 * 60 * 1000);
    const originalId = await createAppointment(fixture.assignmentId, fixture.instructorId, {
      studentId: fixture.studentId,
      checkpointId: fixture.checkpointId,
      startAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
      endAt: new Date(Date.now() + 3 * 60 * 60 * 1000 + 30 * 60 * 1000),
      status: 'booked',
    });
    const replacementId = await createAppointment(fixture.assignmentId, fixture.instructorId, {
      startAt: replacementStartAt,
      endAt: replacementEndAt,
    });

    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(session(fixture.studentId, 'student'));
    const results = await Promise.all([
      rescheduleAppointmentHandler({
        data: { appointmentId: originalId, replacementAppointmentId: replacementId },
      }),
      rescheduleAppointmentHandler({
        data: { appointmentId: originalId, replacementAppointmentId: replacementId },
      }),
    ]);

    expect(results.filter((result) => 'appointment' in result)).toHaveLength(1);
    expect(results.filter((result) => 'error' in result)).toHaveLength(1);

    const [original] = await db
      .select({ id: appointments.id, status: appointments.status, startAt: appointments.startAt })
      .from(appointments)
      .where(eq(appointments.id, originalId));
    const [replacement] = await db
      .select({ status: appointments.status })
      .from(appointments)
      .where(eq(appointments.id, replacementId));
    expect(original.id).toBe(originalId);
    expect(original.status).toBe('booked');
    expect(original.startAt.getTime()).toBe(replacementStartAt.getTime());
    expect(replacement.status).toBe('cancelled');
  });

  it('rejects cross-assignment appointments and soft-deleted students without mutation', async () => {
    const unrelatedId = await createAppointment(
      fixture.unrelatedAssignmentId,
      fixture.instructorId,
    );
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(session(fixture.studentId, 'student'));

    const crossAssignment = await bookAppointmentHandler({ data: { appointmentId: unrelatedId } });
    expect(crossAssignment).toMatchObject({ error: { code: expect.any(String) } });

    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, fixture.studentId));
    const availableId = await createAppointment(fixture.assignmentId, fixture.instructorId);
    const deletedUser = await bookAppointmentHandler({ data: { appointmentId: availableId } });
    expect(deletedUser).toMatchObject({ error: { code: expect.any(String) } });

    const rows = await db
      .select({ status: appointments.status, studentId: appointments.studentId })
      .from(appointments)
      .where(
        and(
          inArray(appointments.id, [unrelatedId, availableId]),
          eq(appointments.status, 'available'),
        ),
      );
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.studentId === null)).toBe(true);
  });

  it('does not expose soft-deleted student PII in instructor appointment lists', async () => {
    const appointmentId = await createAppointment(fixture.assignmentId, fixture.instructorId, {
      studentId: fixture.studentId,
      checkpointId: fixture.checkpointId,
      status: 'booked',
    });
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, fixture.studentId));
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(
      session(fixture.instructorId, 'instructor'),
    );

    const result = await listInstructorAppointmentsHandler({
      data: { assignmentId: fixture.assignmentId, page: 1, limit: 20 },
    });

    expect('appointments' in result).toBe(true);
    if ('appointments' in result) {
      expect(result.appointments).toContainEqual(
        expect.objectContaining({
          id: appointmentId,
          studentName: null,
          studentEmail: null,
        }),
      );
    }
  });

  it('allows only one concurrent instructor outcome transition', async () => {
    const endAt = new Date(Date.now() - 5 * 60 * 1000);
    const originalId = await createAppointment(fixture.assignmentId, fixture.instructorId, {
      studentId: fixture.studentId,
      checkpointId: fixture.checkpointId,
      startAt: new Date(endAt.getTime() - 30 * 60 * 1000),
      endAt,
      status: 'booked',
    });
    vi.mocked(auth.getSessionFromHeaders).mockResolvedValue(
      session(fixture.instructorId, 'instructor'),
    );

    const results = await Promise.all([
      completeAppointmentHandler({ data: { appointmentId: originalId } }),
      completeAppointmentHandler({ data: { appointmentId: originalId } }),
    ]);

    expect(results.filter((result) => 'appointment' in result)).toHaveLength(1);
    expect(results.filter((result) => 'error' in result)).toHaveLength(1);
    const [appointment] = await db
      .select({ status: appointments.status })
      .from(appointments)
      .where(eq(appointments.id, originalId));
    expect(appointment.status).toBe('completed');
  });
});
