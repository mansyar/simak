import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sendInvitationEmail,
  sendPasswordResetEmail,
  sendSLAAlertEmail,
  escapeHtml,
  resolveEmailRecipient,
} from '@/lib/email';
import { getEnv } from '@/config/env';
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
  const where = vi.fn().mockReturnThis();
  const from = vi.fn().mockReturnThis();
  const then = vi
    .fn()
    .mockImplementation((fn: any) => Promise.resolve([{ locale: 'en' }]).then(fn));
  const select = vi.fn().mockReturnValue({ from, where, then });
  return { insert, values, select, from, where, then };
}

function getLastBodyHtml(mockDb: ReturnType<typeof createMockDb>) {
  return mockDb.values.mock.calls[0][0].bodyHtml as string;
}

describe('Email library', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as any);
  });

  describe('escapeHtml', () => {
    it('escapes HTML special characters', () => {
      expect(escapeHtml(`& < > " '`)).toBe('&amp; &lt; &gt; &quot; &#39;');
    });

    it('escapes script tags to harmless entities', () => {
      expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('leaves normal alphanumeric text unchanged', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
    });
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

      const htmlArg = getLastBodyHtml(mockDb);
      expect(htmlArg).toContain('http://localhost:3000/auth/reset-password?token=my-token');
    });

    it('escapes malicious name input in the body', async () => {
      await sendPasswordResetEmail({
        email: 'user@example.com',
        name: '<script>alert("x")</script>',
        token: 'my-token',
      });

      const htmlArg = getLastBodyHtml(mockDb);
      expect(htmlArg).toContain('Hi &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
      expect(htmlArg).not.toContain('<script>alert("x")</script>');
    });

    it('does not escape normal name input', async () => {
      await sendPasswordResetEmail({
        email: 'user@example.com',
        name: 'John Doe',
        token: 'my-token',
      });

      const htmlArg = getLastBodyHtml(mockDb);
      expect(htmlArg).toContain('Hi John Doe,');
    });

    it('resolves the subject using the recipients locale', async () => {
      await sendPasswordResetEmail({
        email: 'user@example.com',
        name: 'John Doe',
        token: 'my-token',
      });

      expect(mockDb.values.mock.calls[0][0].subject).toBe('Reset your SIMAK password');
    });

    it('localizes the subject for Indonesian recipients', async () => {
      mockDb.then.mockImplementationOnce((fn: any) => Promise.resolve([{ locale: 'id' }]).then(fn));

      await sendPasswordResetEmail({
        email: 'user@example.com',
        name: 'John Doe',
        token: 'my-token',
      });

      expect(mockDb.values.mock.calls[0][0].subject).toBe('Reset Kata Sandi SIMAK Anda');
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

      const htmlArg = getLastBodyHtml(mockDb);
      expect(htmlArg).toContain('http://localhost:3000/auth/setup-password?token=invite-token');
    });

    it('escapes malicious name input in the body', async () => {
      await sendInvitationEmail({
        email: 'new@example.com',
        name: '<img src=x onerror=alert(1)>',
        token: 'invite-token',
      });

      const htmlArg = getLastBodyHtml(mockDb);
      expect(htmlArg).toContain('Hi &lt;img src=x onerror=alert(1)&gt;');
      expect(htmlArg).not.toContain('<img src=x onerror=alert(1)>');
    });

    it('does not escape normal name input', async () => {
      await sendInvitationEmail({
        email: 'new@example.com',
        name: 'Jane Doe',
        token: 'invite-token',
      });

      const htmlArg = getLastBodyHtml(mockDb);
      expect(htmlArg).toContain('Hi Jane Doe,');
    });

    it('resolves the subject using the recipients locale', async () => {
      await sendInvitationEmail({
        email: 'new@example.com',
        name: 'Jane Doe',
        token: 'invite-token',
      });

      expect(mockDb.values.mock.calls[0][0].subject).toBe(
        'Welcome to SIMAK — Set up your password',
      );
    });

    it('localizes the subject for Indonesian recipients', async () => {
      mockDb.then.mockImplementationOnce((fn: any) => Promise.resolve([{ locale: 'id' }]).then(fn));

      await sendInvitationEmail({
        email: 'new@example.com',
        name: 'Jane Doe',
        token: 'invite-token',
      });

      expect(mockDb.values.mock.calls[0][0].subject).toBe(
        'Selamat Datang di SIMAK — Atur Kata Sandi Anda',
      );
    });
  });

  describe('sendSLAAlertEmail', () => {
    it('escapes all user-derived fields in the body', async () => {
      await sendSLAAlertEmail({
        adminEmail: 'admin@example.com',
        adminName: '<b>Admin</b>',
        assignmentTitle: '<script>Assignment</script>',
        studentName: '<a href="http://evil.com">Student</a>',
        checkpointName: '<img src=x onerror=alert(1)>',
        breachDays: 5,
      });

      const htmlArg = getLastBodyHtml(mockDb);

      expect(htmlArg).toContain('Hi &lt;b&gt;Admin&lt;/b&gt;,');
      expect(htmlArg).toContain('&lt;script&gt;Assignment&lt;/script&gt;');
      expect(htmlArg).toContain('&lt;a href=&quot;http://evil.com&quot;&gt;Student&lt;/a&gt;');
      expect(htmlArg).toContain('&lt;img src=x onerror=alert(1)&gt;');

      expect(htmlArg).not.toContain('<script>Assignment</script>');
      expect(htmlArg).not.toContain('<a href="http://evil.com">Student</a>');
      expect(htmlArg).not.toContain('<img src=x onerror=alert(1)>');
    });

    it('does not escape server-controlled breach day count', async () => {
      await sendSLAAlertEmail({
        adminEmail: 'admin@example.com',
        adminName: 'Admin',
        assignmentTitle: 'Late Assignment',
        studentName: 'Student',
        checkpointName: 'Checkpoint',
        breachDays: 5,
      });

      const htmlArg = getLastBodyHtml(mockDb);
      expect(htmlArg).toContain('5 days');
    });

    it('does not escape normal user input', async () => {
      await sendSLAAlertEmail({
        adminEmail: 'admin@example.com',
        adminName: 'Admin User',
        assignmentTitle: 'Final Project',
        studentName: 'John Doe',
        checkpointName: 'Draft Review',
        breachDays: 1,
      });

      const htmlArg = getLastBodyHtml(mockDb);
      expect(htmlArg).toContain('Hi Admin User,');
      expect(htmlArg).toContain('Final Project');
      expect(htmlArg).toContain('John Doe');
      expect(htmlArg).toContain('Draft Review');
      expect(htmlArg).toContain('1 day');
    });

    it('resolves the subject using the admin locale and assignment title', async () => {
      await sendSLAAlertEmail({
        adminEmail: 'admin@example.com',
        adminName: 'Admin User',
        assignmentTitle: 'Final Project',
        studentName: 'John Doe',
        checkpointName: 'Draft Review',
        breachDays: 1,
      });

      expect(mockDb.values.mock.calls[0][0].subject).toBe('SLA Breach Alert — Final Project');
    });

    it('localizes the SLA subject for Indonesian recipients', async () => {
      mockDb.then.mockImplementationOnce((fn: any) => Promise.resolve([{ locale: 'id' }]).then(fn));

      await sendSLAAlertEmail({
        adminEmail: 'admin@example.com',
        adminName: 'Admin User',
        assignmentTitle: 'Final Project',
        studentName: 'John Doe',
        checkpointName: 'Draft Review',
        breachDays: 1,
      });

      expect(mockDb.values.mock.calls[0][0].subject).toBe(
        'Peringatan Pelanggaran SLA — Final Project',
      );
    });
  });

  describe('resolveEmailRecipient', () => {
    it('returns { email, locale } for a valid, verified, non-deleted user', async () => {
      mockDb.then.mockImplementationOnce((fn: any) =>
        Promise.resolve([
          { email: 'user@example.com', locale: 'id', emailVerified: true, deletedAt: null },
        ]).then(fn),
      );

      const result = await resolveEmailRecipient('user-1');
      expect(result).toEqual({ email: 'user@example.com', locale: 'id' });
    });

    it('defaults locale to "en" when locale is null', async () => {
      mockDb.then.mockImplementationOnce((fn: any) =>
        Promise.resolve([
          { email: 'user@example.com', locale: null, emailVerified: true, deletedAt: null },
        ]).then(fn),
      );

      const result = await resolveEmailRecipient('user-1');
      expect(result).toEqual({ email: 'user@example.com', locale: 'en' });
    });

    it('defaults locale to "en" when locale is undefined', async () => {
      mockDb.then.mockImplementationOnce((fn: any) =>
        Promise.resolve([
          { email: 'user@example.com', locale: undefined, emailVerified: true, deletedAt: null },
        ]).then(fn),
      );

      const result = await resolveEmailRecipient('user-1');
      expect(result).toEqual({ email: 'user@example.com', locale: 'en' });
    });

    it('defaults locale to "en" when locale is unsupported', async () => {
      mockDb.then.mockImplementationOnce((fn: any) =>
        Promise.resolve([
          { email: 'user@example.com', locale: 'fr', emailVerified: true, deletedAt: null },
        ]).then(fn),
      );

      const result = await resolveEmailRecipient('user-1');
      expect(result).toEqual({ email: 'user@example.com', locale: 'en' });
    });

    it('returns null when user is soft-deleted (deletedAt is not null)', async () => {
      mockDb.then.mockImplementationOnce((fn: any) =>
        Promise.resolve([
          {
            email: 'user@example.com',
            locale: 'en',
            emailVerified: true,
            deletedAt: new Date('2026-01-01'),
          },
        ]).then(fn),
      );

      const result = await resolveEmailRecipient('user-1');
      expect(result).toBeNull();
    });

    it('returns null when emailVerified is null', async () => {
      mockDb.then.mockImplementationOnce((fn: any) =>
        Promise.resolve([
          { email: 'user@example.com', locale: 'en', emailVerified: null, deletedAt: null },
        ]).then(fn),
      );

      const result = await resolveEmailRecipient('user-1');
      expect(result).toBeNull();
    });

    it('returns null when emailVerified is false', async () => {
      mockDb.then.mockImplementationOnce((fn: any) =>
        Promise.resolve([
          { email: 'user@example.com', locale: 'en', emailVerified: false, deletedAt: null },
        ]).then(fn),
      );

      const result = await resolveEmailRecipient('user-1');
      expect(result).toBeNull();
    });

    it('returns null when user is not found', async () => {
      mockDb.then.mockImplementationOnce((fn: any) => Promise.resolve([]).then(fn));

      const result = await resolveEmailRecipient('nonexistent');
      expect(result).toBeNull();
    });

    it('returns null when DB query throws', async () => {
      mockDb.then.mockImplementationOnce(() => {
        throw new Error('DB error');
      });

      const result = await resolveEmailRecipient('user-1');
      expect(result).toBeNull();
    });
  });
});
