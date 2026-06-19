import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendInvitationEmail, sendPasswordResetEmail } from '@/lib/email';
import { getDb } from '@/db/index';
import { emailQueue } from '@/db/schema/index';
vi.mock('@/db/index', () => ({ getDb: vi.fn() }));
vi.mock('@/config/env', () => ({
  getEnv: vi.fn().mockReturnValue({
    RESEND_API_KEY: 'test-key',
    BETTER_AUTH_URL: 'http://localhost:3000',
  }),
}));
function createMockDb() {
  const values = vi.fn().mockReturnThis();
  const insert = vi.fn().mockReturnValue({ values });
  return { insert, values };
}
describe('Email library', () => {
  let mockDb;
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb);
  });
  describe('sendPasswordResetEmail', () => {
    it('should enqueue a password reset email with correct data', async () => {
      const params = {
        email: 'reset@example.com',
        name: 'Reset User',
        token: 'reset-token',
      };
      await sendPasswordResetEmail(params);
      expect(mockDb.insert).toHaveBeenCalledWith(emailQueue);
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientEmail: params.email,
          subject: 'Reset your SIMAK password',
          templateType: 'password_reset',
          status: 'pending',
          attempts: 0,
        }),
      );
    });
    it('should include reset URL in the email body', async () => {
      await sendPasswordResetEmail({
        email: 'user@example.com',
        name: 'User',
        token: 'my-token',
      });
      const htmlArg = mockDb.values.mock.calls[0][0].bodyHtml;
      expect(htmlArg).toContain('http://localhost:3000/auth/reset-password?token=my-token');
    });
  });
  describe('sendInvitationEmail', () => {
    it('should enqueue an invitation email with correct data', async () => {
      const params = {
        email: 'test@example.com',
        name: 'Test User',
        token: 'test-token',
      };
      await sendInvitationEmail(params);
      expect(mockDb.insert).toHaveBeenCalledWith(emailQueue);
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientEmail: params.email,
          templateType: 'invitation',
          status: 'pending',
          attempts: 0,
        }),
      );
    });
    it('should include setup URL in the email body', async () => {
      await sendInvitationEmail({
        email: 'new@example.com',
        name: 'New User',
        token: 'invite-token',
      });
      const htmlArg = mockDb.values.mock.calls[0][0].bodyHtml;
      expect(htmlArg).toContain('http://localhost:3000/auth/setup-password?token=invite-token');
    });
  });
});
