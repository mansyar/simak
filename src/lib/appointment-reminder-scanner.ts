import { aliasedTable, and, eq, gt, inArray, isNotNull, isNull, lt, lte } from 'drizzle-orm';
import { getDb } from '@/db/index';
import { appointmentReminders } from '@/db/schema/appointment-reminders';
import { appointments } from '@/db/schema/appointments';
import { assignmentStudents, assignments } from '@/db/schema/assignments';
import { users } from '@/db/schema/users';
import { logger } from '@/lib/logger';
import { notifyAppointmentParticipants } from '@/lib/appointment-notifications';

export type AppointmentReminderTier = '24h' | '1h';
type AppointmentReminderStatus = 'available' | 'booked' | 'cancelled' | 'completed' | 'no_show';

export type AppointmentReminderCandidate = {
  appointmentId: number;
  assignmentId: number;
  checkpointId: number | null;
  instructorId: string;
  studentId: string;
  startAt: Date;
  endAt: Date;
  status: AppointmentReminderStatus;
};

const REMINDER_WINDOWS = [
  { tier: '24h', event: 'appointment_reminder_24h', lowerHours: 23, upperHours: 24 },
  { tier: '1h', event: 'appointment_reminder_1h', lowerHours: 0, upperHours: 1 },
] as const;

function windowFor(tier: AppointmentReminderTier) {
  return REMINDER_WINDOWS.find((window) => window.tier === tier)!;
}

export function isAppointmentReminderEligible(
  appointment: Pick<AppointmentReminderCandidate, 'status' | 'startAt'>,
  now: Date,
  tier: AppointmentReminderTier,
): boolean {
  if (appointment.status !== 'booked') return false;

  const window = windowFor(tier);
  const lowerBound = now.getTime() + window.lowerHours * 60 * 60 * 1000;
  const upperBound = now.getTime() + window.upperHours * 60 * 60 * 1000;
  const startAt = appointment.startAt.getTime();
  return startAt > lowerBound && startAt <= upperBound;
}

function buildBounds(now: Date, lowerHours: number, upperHours: number) {
  return {
    lower: new Date(now.getTime() + lowerHours * 60 * 60 * 1000),
    upper: new Date(now.getTime() + upperHours * 60 * 60 * 1000),
  };
}

function groupWinners(
  winners: Array<{ appointmentId: number; participantId: string; tier: AppointmentReminderTier }>,
  candidates: AppointmentReminderCandidate[],
) {
  const candidatesById = new Map(
    candidates.map((candidate) => [candidate.appointmentId, candidate]),
  );
  const grouped = new Map<
    string,
    {
      candidate: AppointmentReminderCandidate;
      tier: AppointmentReminderTier;
      participantIds: string[];
    }
  >();

  for (const winner of winners) {
    const candidate = candidatesById.get(winner.appointmentId);
    if (!candidate) continue;

    const key = `${winner.appointmentId}:${winner.tier}`;
    const existing = grouped.get(key);
    if (existing) {
      if (!existing.participantIds.includes(winner.participantId)) {
        existing.participantIds.push(winner.participantId);
      }
      continue;
    }

    grouped.set(key, {
      candidate,
      tier: winner.tier,
      participantIds: [winner.participantId],
    });
  }

  return [...grouped.values()];
}

export async function processAppointmentReminders(now = new Date()): Promise<void> {
  const scanLogger = logger.child({ requestId: crypto.randomUUID() });
  let db: ReturnType<typeof getDb>;

  try {
    db = getDb();
  } catch (error) {
    scanLogger.error({
      event: 'appointment_reminder.scan_error',
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  const instructorUsers = aliasedTable(users, 'appointment_reminder_instructor');
  const studentUsers = aliasedTable(users, 'appointment_reminder_student');
  let scanFailed = false;

  for (const window of REMINDER_WINDOWS) {
    try {
      const bounds = buildBounds(now, window.lowerHours, window.upperHours);
      const queriedAppointments = await db
        .select({
          appointmentId: appointments.id,
          assignmentId: appointments.assignmentId,
          checkpointId: appointments.checkpointId,
          instructorId: appointments.instructorId,
          studentId: appointments.studentId,
          startAt: appointments.startAt,
          endAt: appointments.endAt,
          status: appointments.status,
        })
        .from(appointments)
        .innerJoin(assignments, eq(appointments.assignmentId, assignments.id))
        .innerJoin(
          assignmentStudents,
          and(
            eq(assignmentStudents.assignmentId, appointments.assignmentId),
            eq(assignmentStudents.studentId, appointments.studentId),
          ),
        )
        .innerJoin(instructorUsers, eq(appointments.instructorId, instructorUsers.id))
        .innerJoin(studentUsers, eq(appointments.studentId, studentUsers.id))
        .where(
          and(
            eq(appointments.status, 'booked'),
            isNotNull(appointments.studentId),
            gt(appointments.startAt, bounds.lower),
            lte(appointments.startAt, bounds.upper),
            eq(assignments.status, 'active'),
            isNull(assignments.deletedAt),
            isNull(instructorUsers.deletedAt),
            isNull(studentUsers.deletedAt),
          ),
        );

      const candidates = queriedAppointments.filter(
        (appointment): appointment is AppointmentReminderCandidate =>
          appointment.studentId !== null &&
          isAppointmentReminderEligible(appointment, now, window.tier),
      );
      if (candidates.length === 0) continue;

      const { winners, lockedCandidates } = await db.transaction(async (tx) => {
        const staleClaimCutoff = new Date(now.getTime() - 10 * 60 * 1000);
        await tx
          .delete(appointmentReminders)
          .where(
            and(
              isNull(appointmentReminders.sentAt),
              lt(appointmentReminders.claimedAt, staleClaimCutoff),
            ),
          );

        const lockedRows = await tx
          .select({
            appointmentId: appointments.id,
            assignmentId: appointments.assignmentId,
            checkpointId: appointments.checkpointId,
            instructorId: appointments.instructorId,
            studentId: appointments.studentId,
            startAt: appointments.startAt,
            endAt: appointments.endAt,
            status: appointments.status,
          })
          .from(appointments)
          .innerJoin(assignments, eq(appointments.assignmentId, assignments.id))
          .innerJoin(
            assignmentStudents,
            and(
              eq(assignmentStudents.assignmentId, appointments.assignmentId),
              eq(assignmentStudents.studentId, appointments.studentId),
            ),
          )
          .innerJoin(instructorUsers, eq(appointments.instructorId, instructorUsers.id))
          .innerJoin(studentUsers, eq(appointments.studentId, studentUsers.id))
          .where(
            and(
              inArray(
                appointments.id,
                candidates.map((candidate) => candidate.appointmentId),
              ),
              eq(appointments.status, 'booked'),
              isNotNull(appointments.studentId),
              gt(appointments.startAt, bounds.lower),
              lte(appointments.startAt, bounds.upper),
              eq(assignments.status, 'active'),
              isNull(assignments.deletedAt),
              isNull(instructorUsers.deletedAt),
              isNull(studentUsers.deletedAt),
            ),
          )
          .for('update', { of: appointments });
        const lockedCandidates = lockedRows.filter(
          (appointment): appointment is AppointmentReminderCandidate =>
            appointment.studentId !== null &&
            isAppointmentReminderEligible(appointment, now, window.tier),
        );
        const reminderRows = lockedCandidates.flatMap((candidate) => [
          {
            appointmentId: candidate.appointmentId,
            participantId: candidate.studentId,
            tier: window.tier,
            claimedAt: now,
          },
          {
            appointmentId: candidate.appointmentId,
            participantId: candidate.instructorId,
            tier: window.tier,
            claimedAt: now,
          },
        ]);

        const winners =
          lockedCandidates.length === 0
            ? []
            : await tx
                .insert(appointmentReminders)
                .values(reminderRows)
                .onConflictDoNothing({
                  target: [
                    appointmentReminders.appointmentId,
                    appointmentReminders.participantId,
                    appointmentReminders.tier,
                  ],
                })
                .returning({
                  appointmentId: appointmentReminders.appointmentId,
                  participantId: appointmentReminders.participantId,
                  tier: appointmentReminders.tier,
                });

        return { winners, lockedCandidates };
      });

      const groupedWinners = groupWinners(winners, lockedCandidates);
      const deliveryResults = await Promise.allSettled(
        groupedWinners.map(async ({ candidate, tier, participantIds }) => {
          let failedParticipantIds: string[] = [];
          try {
            failedParticipantIds =
              (await notifyAppointmentParticipants({
                event: windowFor(tier).event,
                appointmentId: candidate.appointmentId,
                assignmentId: candidate.assignmentId,
                checkpointId: candidate.checkpointId,
                participantIds,
                startAt: candidate.startAt,
                endAt: candidate.endAt,
              })) ?? [];
          } catch (error) {
            failedParticipantIds = participantIds;
            scanFailed = true;
            scanLogger.error({
              event: 'appointment_reminder.delivery_error',
              appointmentId: candidate.appointmentId,
              tier,
              error: error instanceof Error ? error.message : String(error),
            });
          }

          if (failedParticipantIds.length > 0) {
            scanFailed = true;
            scanLogger.error({
              event: 'appointment_reminder.delivery_partial_failure',
              appointmentId: candidate.appointmentId,
              tier,
              participantIds: failedParticipantIds,
            });
          }

          const claimFilter = and(
            eq(appointmentReminders.appointmentId, candidate.appointmentId),
            eq(appointmentReminders.tier, tier),
            inArray(appointmentReminders.participantId, failedParticipantIds),
          );
          if (failedParticipantIds.length > 0) {
            await db.delete(appointmentReminders).where(claimFilter);
          }

          const deliveredParticipantIds = participantIds.filter(
            (participantId) => !failedParticipantIds.includes(participantId),
          );
          if (deliveredParticipantIds.length === 0) return;

          await db
            .update(appointmentReminders)
            .set({ sentAt: new Date() })
            .where(
              and(
                eq(appointmentReminders.appointmentId, candidate.appointmentId),
                eq(appointmentReminders.tier, tier),
                inArray(appointmentReminders.participantId, deliveredParticipantIds),
              ),
            );
        }),
      );
      const deliveryFailure = deliveryResults.find(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );
      if (deliveryFailure) {
        scanFailed = true;
        scanLogger.error({
          event: 'appointment_reminder.delivery_error',
          error:
            deliveryFailure.reason instanceof Error
              ? deliveryFailure.reason.message
              : String(deliveryFailure.reason),
        });
      }
    } catch (error) {
      scanFailed = true;
      scanLogger.error({
        event: 'appointment_reminder.scan_error',
        tier: window.tier,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (scanFailed) {
    throw new Error('One or more appointment reminder windows failed');
  }
}
