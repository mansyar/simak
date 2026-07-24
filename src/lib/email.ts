import { eq } from 'drizzle-orm';
import { getEnv } from '../config/env';
import { getDb } from '@/db/index';
import { emailQueue } from '@/db/schema/index';
import { users } from '@/db/schema/users';
import { resolveEmailSubject } from './i18n-server';
import type { Locales } from '../i18n/types';

export type TemplateType =
  | 'password_reset'
  | 'invitation'
  | 'sla_alert'
  | 'two_factor'
  | 'submission_received'
  | 'review_completed'
  | 'revision_requested'
  | 'consultation_verified'
  | 'consultation_rejected'
  | 'extension_approved'
  | 'extension_rejected'
  | 'extension_requested'
  | 'deadline_reminder';

async function getUserLocaleByEmail(email: string): Promise<Locales> {
  try {
    const [user] = await getDb()
      .select({ locale: users.locale })
      .from(users)
      .where(eq(users.email, email));
    return (user?.locale as Locales) ?? 'en';
  } catch {
    return 'en';
  }
}

export type EmailRecipient = {
  email: string;
  locale: Locales;
  settings?: {
    reducedMotion?: boolean;
    notificationPrefs?: Record<string, { email?: boolean; inApp?: boolean }>;
  } | null;
};

export async function resolveEmailRecipient(userId: string): Promise<EmailRecipient | null> {
  try {
    const [user] = await getDb()
      .select({
        email: users.email,
        locale: users.locale,
        emailVerified: users.emailVerified,
        deletedAt: users.deletedAt,
        settings: users.settings,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) return null;
    if (user.deletedAt !== null) return null;
    if (!user.emailVerified) return null;

    const locale: Locales = user.locale === 'en' || user.locale === 'id' ? user.locale : 'en';
    return { email: user.email, locale, settings: user.settings };
  } catch {
    return null;
  }
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function enqueueEmail(params: {
  recipientEmail: string;
  subject: string;
  bodyHtml: string;
  templateType: TemplateType;
}): Promise<void> {
  const db = getDb();
  await db.insert(emailQueue).values({
    recipientEmail: params.recipientEmail,
    subject: params.subject,
    bodyHtml: params.bodyHtml,
    templateType: params.templateType,
    status: 'pending',
    attempts: 0,
  });
}

export async function sendPasswordResetEmail(params: {
  email: string;
  name: string;
  token: string;
}): Promise<void> {
  const resetUrl = `${getEnv().BETTER_AUTH_URL}/auth/reset-password?token=${params.token}`;
  const safeName = escapeHtml(params.name);
  const locale = await getUserLocaleByEmail(params.email);

  await enqueueEmail({
    recipientEmail: params.email,
    subject: resolveEmailSubject('emails.subjects.password_reset', undefined, locale),
    bodyHtml: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f9fafb;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <tr>
              <td style="padding: 40px 32px 24px; text-align: center; border-bottom: 1px solid #e5e7eb;">
                <h1 style="font-size: 24px; font-weight: 700; color: #111827; margin: 0;">SIMAK</h1>
                <p style="font-size: 14px; color: #6b7280; margin: 4px 0 0;">Sistem Informasi dan Manajemen Akademik</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 32px;">
                <p style="font-size: 16px; color: #374151; margin: 0 0 16px;">Hi ${safeName},</p>
                <p style="font-size: 16px; color: #374151; margin: 0 0 24px;">
                  We received a request to reset your SIMAK password. Click the button below to set a new password. This link expires in 1 hour.
                </p>
                <table cellpadding="0" cellspacing="0" style="margin: 0 auto 32px;">
                  <tr>
                    <td style="background-color: #2563eb; border-radius: 6px; padding: 12px 24px;">
                      <a href="${resetUrl}" style="color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; display: inline-block;">
                        Reset Password
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="font-size: 14px; color: #9ca3af; margin: 0 0 8px;">
                  If you didn't request a password reset, you can safely ignore this email.
                </p>
                <p style="font-size: 14px; color: #9ca3af; margin: 0;">
                  If the button doesn't work, copy and paste this link into your browser:<br/>
                  <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding: 24px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
                <p style="font-size: 12px; color: #9ca3af; margin: 0;">&copy; 2026 SIMAK. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
    templateType: 'password_reset',
  });
}

export async function sendInvitationEmail(params: {
  email: string;
  name: string;
  token: string;
}): Promise<void> {
  const setupUrl = `${getEnv().BETTER_AUTH_URL}/auth/setup-password?token=${params.token}`;
  const safeName = escapeHtml(params.name);
  const locale = await getUserLocaleByEmail(params.email);

  await enqueueEmail({
    recipientEmail: params.email,
    subject: resolveEmailSubject('emails.subjects.invitation', undefined, locale),
    bodyHtml: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f9fafb;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <tr>
              <td style="padding: 40px 32px 24px; text-align: center; border-bottom: 1px solid #e5e7eb;">
                <h1 style="font-size: 24px; font-weight: 700; color: #111827; margin: 0;">SIMAK</h1>
                <p style="font-size: 14px; color: #6b7280; margin: 4px 0 0;">Sistem Informasi dan Manajemen Akademik</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 32px;">
                <p style="font-size: 16px; color: #374151; margin: 0 0 16px;">Hi ${safeName},</p>
                <p style="font-size: 16px; color: #374151; margin: 0 0 24px;">
                  An account has been created for you on SIMAK. Click the button below to set up your password. This link expires in 1 hour.
                </p>
                <table cellpadding="0" cellspacing="0" style="margin: 0 auto 32px;">
                  <tr>
                    <td style="background-color: #2563eb; border-radius: 6px; padding: 12px 24px;">
                      <a href="${setupUrl}" style="color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; display: inline-block;">
                        Set Up Password
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="font-size: 14px; color: #9ca3af; margin: 0 0 8px;">
                  Welcome aboard! We're excited to have you on SIMAK.
                </p>
                <p style="font-size: 14px; color: #9ca3af; margin: 0;">
                  If the button doesn't work, copy and paste this link into your browser:<br/>
                  <a href="${setupUrl}" style="color: #2563eb; word-break: break-all;">${setupUrl}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding: 24px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
                <p style="font-size: 12px; color: #9ca3af; margin: 0;">&copy; 2026 SIMAK. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
    templateType: 'invitation',
  });
}

export async function sendSLAAlertEmail(params: {
  adminEmail: string;
  adminName: string;
  assignmentTitle: string;
  studentName: string;
  checkpointName: string;
  breachDays: number;
}): Promise<void> {
  const { adminEmail, adminName, assignmentTitle, studentName, checkpointName, breachDays } =
    params;
  const safeAdminName = escapeHtml(adminName);
  const safeAssignmentTitle = escapeHtml(assignmentTitle);
  const safeStudentName = escapeHtml(studentName);
  const safeCheckpointName = escapeHtml(checkpointName);
  const locale = await getUserLocaleByEmail(adminEmail);

  await enqueueEmail({
    recipientEmail: adminEmail,
    subject: resolveEmailSubject(
      'emails.subjects.sla_alert',
      { assignmentTitle: safeAssignmentTitle },
      locale,
    ),
    bodyHtml: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f9fafb;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <tr>
              <td style="padding: 40px 32px 24px; text-align: center; border-bottom: 1px solid #e5e7eb;">
                <h1 style="font-size: 24px; font-weight: 700; color: #111827; margin: 0;">SIMAK</h1>
                <p style="font-size: 14px; color: #6b7280; margin: 4px 0 0;">Sistem Informasi dan Manajemen Akademik</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 32px;">
                <p style="font-size: 16px; color: #374151; margin: 0 0 16px;">Hi ${safeAdminName},</p>
                <p style="font-size: 16px; color: #374151; margin: 0 0 24px;">
                  An instructor has exceeded the 3-day SLA (Service Level Agreement) for reviewing a student submission. Please review the details below.
                </p>
                <table cellpadding="0" cellspacing="0" style="width: 100%; margin-bottom: 24px; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 12px 16px; background-color: #f3f4f6; font-size: 14px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Assignment</td>
                    <td style="padding: 12px 16px; font-size: 14px; color: #374151; border-bottom: 1px solid #e5e7eb;">${safeAssignmentTitle}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 16px; background-color: #f3f4f6; font-size: 14px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Student</td>
                    <td style="padding: 12px 16px; font-size: 14px; color: #374151; border-bottom: 1px solid #e5e7eb;">${safeStudentName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 16px; background-color: #f3f4f6; font-size: 14px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Checkpoint</td>
                    <td style="padding: 12px 16px; font-size: 14px; color: #374151; border-bottom: 1px solid #e5e7eb;">${safeCheckpointName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 16px; background-color: #f3f4f6; font-size: 14px; font-weight: 600; color: #dc2626;">Breach Duration</td>
                    <td style="padding: 12px 16px; font-size: 14px; color: #dc2626; font-weight: 600;">${breachDays} day${breachDays !== 1 ? 's' : ''}</td>
                  </tr>
                </table>
                <p style="font-size: 14px; color: #9ca3af; margin: 0 0 8px;">
                  The student's deadlines have been automatically extended by the breach duration.
                </p>
                <p style="font-size: 14px; color: #9ca3af; margin: 0;">
                  No further action is required from you at this time. This notification is for your awareness.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding: 24px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
                <p style="font-size: 12px; color: #9ca3af; margin: 0;">&copy; 2026 SIMAK. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
    templateType: 'sla_alert',
  });
}
