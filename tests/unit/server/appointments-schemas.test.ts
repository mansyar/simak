/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';

const serverFnBuilders = vi.hoisted(() => [] as Array<Record<string, ReturnType<typeof vi.fn>>>);

vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockImplementation(() => {
    const builder = {
      middleware: vi.fn().mockReturnThis(),
      inputValidator: vi.fn().mockReturnThis(),
      handler: vi.fn().mockImplementation((fn) => fn),
    };
    serverFnBuilders.push(builder);
    return builder;
  }),
  createMiddleware: vi.fn().mockReturnValue({
    server: vi.fn().mockImplementation((fn) => fn),
  }),
}));

import {
  AppointmentIdSchema,
  BookAppointmentSchema,
  CancelAppointmentSchema,
  CompleteAppointmentSchema,
  CreateAppointmentSlotSchema,
  ListAvailableAppointmentsSchema,
  ListInstructorAppointmentsSchema,
  ListStudentAppointmentsSchema,
  MarkAppointmentNoShowSchema,
  RescheduleAppointmentSchema,
  bookAppointment,
  cancelAppointment,
  completeAppointment,
  createAppointmentSlot,
  getAppointmentDetail,
  listAvailableAppointments,
  listInstructorAppointments,
  listStudentAppointments,
  markAppointmentNoShow,
  rescheduleAppointment,
} from '@/server/appointments';

const futureDate = (minutesFromNow: number): string =>
  new Date(Date.now() + minutesFromNow * 60_000).toISOString();

describe('Appointment server-function contracts', () => {
  describe('CreateAppointmentSlotSchema', () => {
    it('accepts assignment-required and checkpoint-optional UTC inputs', () => {
      const result = CreateAppointmentSlotSchema.safeParse({
        assignmentId: '12',
        checkpointId: '7',
        startAt: futureDate(30),
        endAt: futureDate(60),
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.assignmentId).toBe(12);
        expect(result.data.checkpointId).toBe(7);
        expect(result.data.startAt).toBeInstanceOf(Date);
        expect(result.data.endAt).toBeInstanceOf(Date);
      }
    });

    it('accepts a slot without a checkpoint', () => {
      const result = CreateAppointmentSlotSchema.safeParse({
        assignmentId: 12,
        startAt: futureDate(30),
        endAt: futureDate(60),
      });

      expect(result.success).toBe(true);
    });

    it('rejects a missing assignment or malformed timestamp', () => {
      expect(
        CreateAppointmentSlotSchema.safeParse({
          startAt: futureDate(30),
          endAt: futureDate(60),
        }).success,
      ).toBe(false);
      expect(
        CreateAppointmentSlotSchema.safeParse({
          assignmentId: 12,
          startAt: 'not-a-date',
          endAt: futureDate(60),
        }).success,
      ).toBe(false);
    });
  });

  it('applies bounded pagination and optional status filters to list contracts', () => {
    const instructorResult = ListInstructorAppointmentsSchema.safeParse({
      assignmentId: '12',
      status: 'available',
    });
    const availableResult = ListAvailableAppointmentsSchema.safeParse({ assignmentId: 12 });
    const studentResult = ListStudentAppointmentsSchema.safeParse({});

    expect(instructorResult.success).toBe(true);
    expect(availableResult.success).toBe(true);
    expect(studentResult.success).toBe(true);
    if (instructorResult.success) {
      expect(instructorResult.data.page).toBe(1);
      expect(instructorResult.data.limit).toBe(20);
      expect(instructorResult.data.status).toBe('available');
    }
    if (studentResult.success) {
      expect(studentResult.data.page).toBe(1);
      expect(studentResult.data.limit).toBe(20);
    }
  });

  it('rejects invalid appointment IDs and pagination bounds', () => {
    expect(AppointmentIdSchema.safeParse({ appointmentId: 0 }).success).toBe(false);
    expect(
      ListInstructorAppointmentsSchema.safeParse({ assignmentId: 1, limit: 101 }).success,
    ).toBe(false);
    expect(ListAvailableAppointmentsSchema.safeParse({ assignmentId: 1, page: 0 }).success).toBe(
      false,
    );
  });

  it('validates booking, cancellation, rescheduling, and terminal transitions', () => {
    expect(BookAppointmentSchema.safeParse({ appointmentId: '4', checkpointId: '9' }).success).toBe(
      true,
    );
    expect(
      CancelAppointmentSchema.safeParse({ appointmentId: 4, reason: 'Schedule changed' }).success,
    ).toBe(true);
    expect(
      RescheduleAppointmentSchema.safeParse({ appointmentId: 4, replacementAppointmentId: 8 })
        .success,
    ).toBe(true);
    expect(CompleteAppointmentSchema.safeParse({ appointmentId: 4 }).success).toBe(true);
    expect(MarkAppointmentNoShowSchema.safeParse({ appointmentId: 4 }).success).toBe(true);
    expect(CancelAppointmentSchema.safeParse({ appointmentId: 4, reason: ' ' }).success).toBe(
      false,
    );
  });

  it('exports callable stubs for every appointment operation', () => {
    expect(
      [
        createAppointmentSlot,
        listInstructorAppointments,
        cancelAppointment,
        listAvailableAppointments,
        listStudentAppointments,
        bookAppointment,
        rescheduleAppointment,
        completeAppointment,
        markAppointmentNoShow,
        getAppointmentDetail,
      ].every((stub) => typeof stub === 'function'),
    ).toBe(true);
  });

  it('uses the standard typedServerFn middleware, validator, and handler chain', () => {
    const appointmentBuilders = serverFnBuilders.slice(-10);
    expect(appointmentBuilders).toHaveLength(10);
    for (const builder of appointmentBuilders) {
      expect(builder.middleware).toHaveBeenCalledTimes(1);
      expect(builder.inputValidator).toHaveBeenCalledTimes(1);
      expect(builder.handler).toHaveBeenCalledTimes(1);
    }
  });
});
