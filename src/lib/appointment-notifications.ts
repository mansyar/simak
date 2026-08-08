import { getDb } from '@/db/index';
import { getNotificationKeys } from '@/lib/i18n-server';
import { logger } from '@/lib/logger';
import { maybeInsertNotification } from '@/lib/notification-prefs';

export type AppointmentNotificationEvent =
  | 'appointment_booked'
  | 'appointment_cancelled'
  | 'appointment_rescheduled'
  | 'appointment_completed'
  | 'appointment_no_show'
  | 'appointment_reminder_24h'
  | 'appointment_reminder_1h';

export interface AppointmentNotificationInput {
  event: AppointmentNotificationEvent;
  appointmentId: number;
  assignmentId: number;
  checkpointId?: number | null;
  participantIds: string[];
  startAt: Date;
  endAt: Date;
}

/**
 * Delivers preference-aware in-app appointment notifications after a committed mutation.
 * Each recipient is isolated so advisory notification failures cannot affect the mutation.
 */
export async function notifyAppointmentParticipants({
  event,
  appointmentId,
  assignmentId,
  checkpointId,
  participantIds,
  startAt,
  endAt,
}: AppointmentNotificationInput): Promise<void> {
  const recipientIds = [...new Set(participantIds.filter(Boolean))];
  if (recipientIds.length === 0) return;

  const { titleKey, messageKey } = getNotificationKeys(event);
  const params = {
    appointmentId: String(appointmentId),
    assignmentId: String(assignmentId),
    ...(checkpointId == null ? {} : { checkpointId: String(checkpointId) }),
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
  };
  const metadata = {
    appointmentId,
    assignmentId,
    ...(checkpointId == null ? {} : { checkpointId }),
  };
  try {
    const db = getDb();
    await Promise.all(
      recipientIds.map(async (recipientId) => {
        try {
          await maybeInsertNotification(db, recipientId, event, {
            userId: recipientId,
            type: event,
            titleKey,
            messageKey,
            params,
            channel: 'in_app',
            metadata,
          });
        } catch (error) {
          logger.error({
            event: 'advisory_failed',
            handler: 'notifyAppointmentParticipants',
            recipientId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }),
    );
  } catch (error) {
    logger.error({
      event: 'advisory_failed',
      handler: 'notifyAppointmentParticipants',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
