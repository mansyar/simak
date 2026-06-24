// Server-only handlers for two-factor authentication operations
import { eq } from 'drizzle-orm';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { auth } from '../auth/config';
import { getDb } from '../db/index';
import { users, twoFactor } from '../db/schema/index';
import { getSessionFromHeaders } from './auth';
import { logAuditEvent } from '../lib/audit';
import { enqueueEmail, escapeHtml } from '../lib/email';
import { revokeUserSessions } from '../lib/auth-session';
import type { z } from 'zod';
import type {
  EnableTwoFactorSchema,
  DisableTwoFactorSchema,
  VerifyTwoFactorSchema,
  RegenerateBackupCodesSchema,
  GetTwoFactorStatusSchema,
} from './two-factor';

type EnableTwoFactorInput = z.infer<typeof EnableTwoFactorSchema>;
type DisableTwoFactorInput = z.infer<typeof DisableTwoFactorSchema>;
type VerifyTwoFactorInput = z.infer<typeof VerifyTwoFactorSchema>;
type RegenerateBackupCodesInput = z.infer<typeof RegenerateBackupCodesSchema>;
type GetTwoFactorStatusInput = z.infer<typeof GetTwoFactorStatusSchema>;

/**
 * Generate TOTP URI and backup codes for 2FA setup.
 * Does NOT enable 2FA yet — user must verify a TOTP code first.
 */
export async function generateTwoFactorSetupHandler(args: { data: EnableTwoFactorInput }) {
  const session = await getSessionFromHeaders();
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const headers = getRequestHeaders();

  try {
    const result = await auth.api.enableTwoFactor({
      body: { password: args.data.password },
      headers,
    });

    // auth.api.enableTwoFactor() returns { totpURI, backupCodes } directly
    const data = result as unknown as { totpURI?: string; backupCodes?: string[] };

    // Log audit event
    await logAuditEvent({
      actorId: session.user.id,
      action: 'two_factor.setup_initiated',
      entityType: 'user',
      entityId: session.user.id,
    });

    return {
      totpURI: data?.totpURI ?? '',
      backupCodes: data?.backupCodes ?? [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { error: message };
  }
}

/**
 * Verify TOTP code to complete 2FA enablement.
 * This sets twoFactorEnabled to true on the user record.
 */
export async function enableTwoFactorHandler(args: { data: VerifyTwoFactorInput }) {
  const session = await getSessionFromHeaders();
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const headers = getRequestHeaders();

  try {
    await auth.api.verifyTOTP({
      body: { code: args.data.code, trustDevice: args.data.trustDevice },
      headers,
    });

    // Log audit event
    await logAuditEvent({
      actorId: session.user.id,
      action: 'two_factor.enabled',
      entityType: 'user',
      entityId: session.user.id,
    });

    // Send email notification
    try {
      await enqueueEmail({
        recipientEmail: session.user.email,
        subject: 'Two-Factor Authentication Enabled',
        bodyHtml: `
          <!DOCTYPE html>
          <html>
            <head><meta charset="utf-8" /></head>
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
                    <h2 style="font-size: 20px; color: #111827; margin: 0 0 16px;">Two-Factor Authentication Enabled</h2>
                    <p style="font-size: 16px; color: #374151; margin: 0 0 16px;">Hi ${escapeHtml(session.user.name)},</p>
                    <p style="font-size: 15px; color: #374151; line-height: 1.6; margin: 0 0 16px;">
                      Two-factor authentication has been successfully enabled on your account. Your account is now more secure.
                    </p>
                    <p style="font-size: 15px; color: #374151; line-height: 1.6; margin: 0 0 16px;">
                      If you did not make this change, please contact your administrator immediately.
                    </p>
                  </td>
                </tr>
              </table>
            </body>
          </html>`,
        templateType: 'two_factor',
      });
    } catch {
      // Email failure is non-fatal
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { error: message };
  }
}

/**
 * Disable 2FA after password confirmation.
 */
export async function disableTwoFactorHandler(args: { data: DisableTwoFactorInput }) {
  const session = await getSessionFromHeaders();
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const headers = getRequestHeaders();

  try {
    await auth.api.disableTwoFactor({
      body: { password: args.data.password },
      headers,
    });

    // Mark 2FA as disabled on the user
    const db = getDb();
    await db
      .update(users)
      .set({ twoFactorEnabled: false, updatedAt: new Date() })
      .where(eq(users.id, session.user.id));

    // Delete the two-factor record
    await db.delete(twoFactor).where(eq(twoFactor.userId, session.user.id));

    // Revoke all sessions so the security change takes effect immediately
    await revokeUserSessions(session.user.id, session.user.id);

    // Log audit event
    await logAuditEvent({
      actorId: session.user.id,
      action: 'two_factor.disabled',
      entityType: 'user',
      entityId: session.user.id,
    });

    // Send email notification
    try {
      await enqueueEmail({
        recipientEmail: session.user.email,
        subject: 'Two-Factor Authentication Disabled',
        bodyHtml: `
          <!DOCTYPE html>
          <html>
            <head><meta charset="utf-8" /></head>
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
                    <h2 style="font-size: 20px; color: #111827; margin: 0 0 16px;">Two-Factor Authentication Disabled</h2>
                    <p style="font-size: 16px; color: #374151; margin: 0 0 16px;">Hi ${escapeHtml(session.user.name)},</p>
                    <p style="font-size: 15px; color: #374151; line-height: 1.6; margin: 0 0 16px;">
                      Two-factor authentication has been disabled on your account. Your account is now less secure.
                    </p>
                    <p style="font-size: 15px; color: #374151; line-height: 1.6; margin: 0 0 16px;">
                      If you did not make this change, please contact your administrator immediately.
                    </p>
                  </td>
                </tr>
              </table>
            </body>
          </html>`,
        templateType: 'two_factor',
      });
    } catch {
      // Email failure is non-fatal
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { error: message };
  }
}

/**
 * Regenerate backup codes after password verification.
 */
export async function regenerateBackupCodesHandler(args: { data: RegenerateBackupCodesInput }) {
  const session = await getSessionFromHeaders();
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const headers = getRequestHeaders();

  try {
    const result = await auth.api.generateBackupCodes({
      body: { password: args.data.password },
      headers,
    });

    const response = (result as { response?: { backupCodes?: string[] } }).response;

    // Log audit event
    await logAuditEvent({
      actorId: session.user.id,
      action: 'two_factor.backup_codes_regenerated',
      entityType: 'user',
      entityId: session.user.id,
    });

    return {
      backupCodes: response?.backupCodes ?? [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { error: message };
  }
}

/**
 * Get the current user's 2FA status.
 */
export async function getTwoFactorStatusHandler(_args: { data: GetTwoFactorStatusInput }) {
  const session = await getSessionFromHeaders();
  if (!session) {
    return { error: 'Unauthorized' };
  }

  const db = getDb();
  const record = await db
    .select({ twoFactorEnabled: users.twoFactorEnabled })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)
    .then((rows) => rows[0]);

  return { enabled: record?.twoFactorEnabled ?? false };
}
