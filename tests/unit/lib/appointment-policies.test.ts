import { describe, expect, it } from 'vitest';
import {
  appointmentStatusSchema,
  appointmentWindowSchema,
  canTransitionAppointment,
  formatAppointmentRange,
  appointmentsOverlap,
  validateAppointmentWindow,
} from '@/lib/appointment-policies';

const now = new Date('2026-08-08T12:00:00.000Z');
const futureStart = new Date('2026-08-08T13:00:00.000Z');
const futureEnd = new Date('2026-08-08T13:30:00.000Z');

describe('appointment window policies', () => {
  it('accepts the inclusive 15–120 minute duration range', () => {
    expect(
      validateAppointmentWindow(futureStart, new Date('2026-08-08T13:15:00.000Z'), now),
    ).toEqual({ valid: true, durationMinutes: 15 });
    expect(
      validateAppointmentWindow(futureStart, new Date('2026-08-08T15:00:00.000Z'), now),
    ).toEqual({ valid: true, durationMinutes: 120 });
  });

  it('rejects invalid order, duration, and past start times', () => {
    expect(
      validateAppointmentWindow(futureStart, new Date('2026-08-08T13:14:00.000Z'), now),
    ).toEqual({ valid: false, reason: 'duration_too_short' });
    expect(
      validateAppointmentWindow(futureStart, new Date('2026-08-08T15:01:00.000Z'), now),
    ).toEqual({ valid: false, reason: 'duration_too_long' });
    expect(
      validateAppointmentWindow(new Date('2026-08-08T13:30:00.000Z'), futureStart, now),
    ).toEqual({ valid: false, reason: 'start_must_be_before_end' });
    expect(
      validateAppointmentWindow(
        new Date('2026-08-08T11:00:00.000Z'),
        new Date('2026-08-08T11:30:00.000Z'),
        now,
      ),
    ).toEqual({ valid: false, reason: 'start_must_be_in_future' });
  });

  it('provides shared status and window input schemas', () => {
    expect(appointmentStatusSchema.parse('available')).toBe('available');
    expect(() => appointmentStatusSchema.parse('expired')).toThrow();

    expect(
      appointmentWindowSchema.parse({
        startAt: '2026-08-08T13:00:00.000Z',
        endAt: '2026-08-08T13:30:00.000Z',
      }),
    ).toEqual({ startAt: futureStart, endAt: futureEnd });
    expect(() =>
      appointmentWindowSchema.parse({
        startAt: 'not-a-date',
        endAt: '2026-08-08T13:30:00.000Z',
      }),
    ).toThrow();
  });
});

describe('appointment lifecycle policies', () => {
  it('allows only valid future and post-end transitions', () => {
    expect(
      canTransitionAppointment('available', 'booked', {
        startAt: futureStart,
        endAt: futureEnd,
        now,
      }),
    ).toEqual({ valid: true });
    expect(
      canTransitionAppointment('booked', 'cancelled', {
        startAt: futureStart,
        endAt: futureEnd,
        now,
      }),
    ).toEqual({ valid: true });
    expect(
      canTransitionAppointment('booked', 'completed', {
        startAt: futureStart,
        endAt: futureEnd,
        now: new Date('2026-08-08T13:31:00.000Z'),
      }),
    ).toEqual({ valid: true });
    expect(
      canTransitionAppointment('booked', 'no_show', {
        startAt: futureStart,
        endAt: futureEnd,
        now: new Date('2026-08-08T13:31:00.000Z'),
      }),
    ).toEqual({ valid: true });
  });

  it('rejects stale, repeated, and invalid transitions', () => {
    expect(
      canTransitionAppointment('available', 'booked', {
        startAt: new Date('2026-08-08T11:00:00.000Z'),
        endAt: new Date('2026-08-08T11:30:00.000Z'),
        now,
      }),
    ).toEqual({ valid: false, reason: 'start_must_be_in_future' });
    expect(
      canTransitionAppointment('booked', 'completed', {
        startAt: futureStart,
        endAt: futureEnd,
        now,
      }),
    ).toEqual({ valid: false, reason: 'appointment_not_ended' });
    expect(
      canTransitionAppointment('cancelled', 'booked', {
        startAt: futureStart,
        endAt: futureEnd,
        now,
      }),
    ).toEqual({ valid: false, reason: 'invalid_transition' });
    expect(
      canTransitionAppointment('booked', 'booked', {
        startAt: futureStart,
        endAt: futureEnd,
        now,
      }),
    ).toEqual({ valid: false, reason: 'invalid_transition' });
  });
});

describe('appointment overlap policies', () => {
  it('uses half-open intervals and ignores cancelled appointments', () => {
    const first = { startAt: futureStart, endAt: futureEnd, status: 'booked' as const };
    expect(
      appointmentsOverlap(first, {
        startAt: new Date('2026-08-08T13:29:00.000Z'),
        endAt: new Date('2026-08-08T14:00:00.000Z'),
        status: 'booked',
      }),
    ).toBe(true);
    expect(
      appointmentsOverlap(first, {
        startAt: futureEnd,
        endAt: new Date('2026-08-08T14:00:00.000Z'),
        status: 'booked',
      }),
    ).toBe(false);
    expect(
      appointmentsOverlap(first, {
        startAt: new Date('2026-08-08T13:15:00.000Z'),
        endAt: new Date('2026-08-08T13:45:00.000Z'),
        status: 'cancelled',
      }),
    ).toBe(false);
  });
});

describe('appointment timezone display', () => {
  it('keeps UTC instants stable across a DST spring-forward boundary', () => {
    const result = formatAppointmentRange(
      new Date('2024-03-10T06:30:00.000Z'),
      new Date('2024-03-10T07:30:00.000Z'),
      'America/New_York',
      'en',
    );

    expect(result.timeZone).toBe('America/New_York');
    expect(result.startLabel).toContain('1:30');
    expect(result.endLabel).toContain('3:30');
    expect(result.endLabel).not.toContain('2:30');
  });

  it('falls back to UTC for an invalid timezone', () => {
    const result = formatAppointmentRange(futureStart, futureEnd, 'not/a-timezone', 'id');

    expect(result.timeZone).toBe('UTC');
    expect(result.startLabel).toContain('13.00');
  });
});
