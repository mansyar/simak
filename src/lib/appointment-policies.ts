import { z } from 'zod';
import { resolveTimeZone } from '@/lib/timezone';

export const APPOINTMENT_MIN_DURATION_MINUTES = 15;
export const APPOINTMENT_MAX_DURATION_MINUTES = 120;

export const appointmentStatusSchema = z.enum([
  'available',
  'booked',
  'cancelled',
  'completed',
  'no_show',
]);

export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;

export const appointmentWindowSchema = z.object({
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
});

type AppointmentWindowReason =
  | 'invalid_date'
  | 'start_must_be_before_end'
  | 'duration_too_short'
  | 'duration_too_long'
  | 'start_must_be_in_future';

type AppointmentWindowResult =
  | { valid: true; durationMinutes: number }
  | { valid: false; reason: AppointmentWindowReason };

type AppointmentWindow = {
  startAt: Date;
  endAt: Date;
  now?: Date;
};

type TransitionResult =
  | { valid: true }
  | {
      valid: false;
      reason: AppointmentWindowReason | 'appointment_not_ended' | 'invalid_transition';
    };

const allowedTransitions: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  available: ['booked', 'cancelled'],
  booked: ['cancelled', 'completed', 'no_show'],
  cancelled: [],
  completed: [],
  no_show: [],
};

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}

export function validateAppointmentWindow(
  startAt: Date,
  endAt: Date,
  now = new Date(),
): AppointmentWindowResult {
  if (!isValidDate(startAt) || !isValidDate(endAt) || !isValidDate(now)) {
    return { valid: false, reason: 'invalid_date' };
  }

  if (startAt.getTime() >= endAt.getTime()) {
    return { valid: false, reason: 'start_must_be_before_end' };
  }

  const durationMinutes = (endAt.getTime() - startAt.getTime()) / 60_000;
  if (durationMinutes < APPOINTMENT_MIN_DURATION_MINUTES) {
    return { valid: false, reason: 'duration_too_short' };
  }

  if (durationMinutes > APPOINTMENT_MAX_DURATION_MINUTES) {
    return { valid: false, reason: 'duration_too_long' };
  }

  if (startAt.getTime() <= now.getTime()) {
    return { valid: false, reason: 'start_must_be_in_future' };
  }

  return { valid: true, durationMinutes };
}

export function canTransitionAppointment(
  currentStatus: AppointmentStatus,
  nextStatus: AppointmentStatus,
  { startAt, endAt, now = new Date() }: AppointmentWindow,
): TransitionResult {
  if (!allowedTransitions[currentStatus].includes(nextStatus)) {
    return { valid: false, reason: 'invalid_transition' };
  }

  if (nextStatus === 'booked' || nextStatus === 'cancelled') {
    const futureResult = validateAppointmentWindow(startAt, endAt, now);
    if (!futureResult.valid && futureResult.reason === 'start_must_be_in_future') {
      return futureResult;
    }
  }

  if (nextStatus === 'completed' || nextStatus === 'no_show') {
    if (now.getTime() <= endAt.getTime()) {
      return { valid: false, reason: 'appointment_not_ended' };
    }
  }

  return { valid: true };
}

type AppointmentInterval = {
  startAt: Date;
  endAt: Date;
  status?: AppointmentStatus;
};

export function appointmentsOverlap(
  first: AppointmentInterval,
  second: AppointmentInterval,
): boolean {
  if (first.status === 'cancelled' || second.status === 'cancelled') {
    return false;
  }

  return (
    first.startAt.getTime() < second.endAt.getTime() &&
    second.startAt.getTime() < first.endAt.getTime()
  );
}

type AppointmentLocale = 'en' | 'id';

export function formatAppointmentRange(
  startAt: Date,
  endAt: Date,
  savedTimeZone: unknown,
  locale: AppointmentLocale = 'en',
): { startLabel: string; endLabel: string; timeZone: string } {
  const timeZone = resolveTimeZone(savedTimeZone);
  const formatter = new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  });

  return {
    startLabel: formatter.format(startAt),
    endLabel: formatter.format(endAt),
    timeZone,
  };
}
