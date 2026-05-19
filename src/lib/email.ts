import { Resend } from 'resend';
import { getEnv } from '../config/env';

const INVITATION_SUBJECT = 'Welcome to SIMAK — Set up your password';

let _resend: Resend | null = null;

function getResend(): Resend {
  if (_resend) return _resend;
  const env = getEnv();
  _resend = new Resend(env.RESEND_API_KEY);
  return _resend;
}

export async function sendPasswordResetEmail(params: {
  email: string;
  name: string;
  token: string;
}): Promise<void> {
  const resend = getResend();
  const resetUrl = `${getEnv().BETTER_AUTH_URL}/auth/reset-password?token=${params.token}`;

  const { error } = await resend.emails.send({
    from: 'SIMAK <noreply@simak.app>',
    to: params.email,
    subject: 'Reset your SIMAK password',
    html: `
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
                <p style="font-size: 16px; color: #374151; margin: 0 0 16px;">Hi ${params.name},</p>
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
  });

  if (error) {
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }
}

export async function sendInvitationEmail(params: {
  email: string;
  name: string;
  token: string;
}): Promise<void> {
  const resend = getResend();
  const setupUrl = `${getEnv().BETTER_AUTH_URL}/auth/setup-password?token=${params.token}`;

  const { error } = await resend.emails.send({
    from: 'SIMAK <noreply@simak.app>',
    to: params.email,
    subject: INVITATION_SUBJECT,
    html: `
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
                <p style="font-size: 16px; color: #374151; margin: 0 0 16px;">Hi ${params.name},</p>
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
  });

  if (error) {
    throw new Error(`Failed to send invitation email: ${error.message}`);
  }
}
