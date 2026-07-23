import type { Locales } from '../i18n/types';
import type { TemplateType } from './email';
import { enqueueEmail, resolveEmailRecipient } from './email';
import { resolveEmailSubject } from './i18n-server';

/** Security-type emails are never gated by user preferences (FR-8). */
const EMAIL_GATE_EXEMPT: ReadonlySet<TemplateType> = new Set([
  'password_reset',
  'invitation',
  'two_factor',
  'sla_alert',
]);

/**
 * Generic post-commit advisory email enqueue.
 * Resolves the recipient, builds the subject, and enqueues the email.
 * Skips silently if the recipient is soft-deleted or has no verified email.
 * Respects email notification preferences unless the templateType is exempt (FR-8).
 * Never throws — logs errors to console.error (advisory-only guarantee).
 */
export async function enqueueEventEmail(opts: {
  recipientId: string;
  subjectKey: string;
  templateType: TemplateType;
  buildBody: (locale: Locales) => string;
  subjectParams?: Record<string, string>;
  notificationType?: string;
}): Promise<void> {
  try {
    const recipient = await resolveEmailRecipient(opts.recipientId);
    if (!recipient) return;

    if (!EMAIL_GATE_EXEMPT.has(opts.templateType)) {
      const notifType = opts.notificationType ?? opts.templateType;
      const emailDisabled = recipient.settings?.notificationPrefs?.[notifType]?.email === false;
      if (emailDisabled) return;
    }

    const subject = `[SIMAK] ${resolveEmailSubject(opts.subjectKey, opts.subjectParams, recipient.locale)}`;
    await enqueueEmail({
      recipientEmail: recipient.email,
      subject,
      bodyHtml: opts.buildBody(recipient.locale),
      templateType: opts.templateType,
    });
  } catch (err) {
    console.error(`Failed to enqueue ${opts.templateType} email:`, err);
  }
}
