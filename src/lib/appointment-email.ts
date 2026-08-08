import type { Locales } from '@/i18n/types';
import { getNotificationKeys, resolveNotificationContent } from '@/lib/i18n-server';
import { escapeHtml, type TemplateType } from '@/lib/email';
import type { AppointmentNotificationEvent } from '@/lib/appointment-notifications';

const APPOINTMENT_EMAILS: Record<
  AppointmentNotificationEvent,
  { subjectKey: string; templateType: TemplateType }
> = {
  appointment_booked: {
    subjectKey: 'emails.subjects.appointmentBooked',
    templateType: 'appointment_booked',
  },
  appointment_cancelled: {
    subjectKey: 'emails.subjects.appointmentCancelled',
    templateType: 'appointment_cancelled',
  },
  appointment_rescheduled: {
    subjectKey: 'emails.subjects.appointmentRescheduled',
    templateType: 'appointment_rescheduled',
  },
  appointment_completed: {
    subjectKey: 'emails.subjects.appointmentCompleted',
    templateType: 'appointment_completed',
  },
  appointment_no_show: {
    subjectKey: 'emails.subjects.appointmentNoShow',
    templateType: 'appointment_no_show',
  },
  appointment_reminder_24h: {
    subjectKey: 'emails.subjects.appointmentReminder',
    templateType: 'appointment_reminder_24h',
  },
  appointment_reminder_1h: {
    subjectKey: 'emails.subjects.appointmentReminder',
    templateType: 'appointment_reminder_1h',
  },
};

export function getAppointmentEmailConfig(event: AppointmentNotificationEvent) {
  return APPOINTMENT_EMAILS[event];
}

export function buildAppointmentEmailBody(
  event: AppointmentNotificationEvent,
  params: Record<string, string>,
  locale: Locales,
): string {
  const { titleKey, messageKey } = getNotificationKeys(event);
  const content = resolveNotificationContent(titleKey, messageKey, params, locale);
  const title = escapeHtml(content.title);
  const message = escapeHtml(content.message ?? '').replace(/\n/g, '<br />');

  return `<!doctype html>
<html lang="${locale}">
  <body style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
    <h1>${title}</h1>
    <p>${message}</p>
  </body>
</html>`;
}
