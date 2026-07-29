/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateTwoFactorSetupHandler,
  enableTwoFactorHandler,
  disableTwoFactorHandler,
  regenerateBackupCodesHandler,
  getTwoFactorStatusHandler,
} from '@/server/two-factor.server';
import * as authMod from '@/server/auth';
import * as dbMod from '@/db/index';
import * as auditMod from '@/lib/audit';
import * as emailMod from '@/lib/email';
import * as i18nServerMod from '@/lib/i18n-server';
import * as authSessionMod from '@/lib/auth-session';
import { auth } from '@/auth/config';

vi.mock('@/server/auth', () => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock('@/auth/config', () => ({
  auth: {
    api: {
      enableTwoFactor: vi.fn(),
      verifyTOTP: vi.fn(),
      disableTwoFactor: vi.fn(),
      generateBackupCodes: vi.fn(),
    },
  },
}));

vi.mock('@/db/index', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: vi.fn().mockReturnValue(new Headers()),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock('@/lib/email', async () => {
  const actual = await vi.importActual<typeof import('@/lib/email')>('@/lib/email');
  return {
    ...actual,
    enqueueEmail: vi.fn(),
  };
});

vi.mock('@/lib/i18n-server', () => ({
  resolveEmailSubject: vi.fn(),
}));

vi.mock('@/lib/auth-session', () => ({
  revokeUserSessions: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/config/env', () => ({
  getEnv: vi.fn().mockReturnValue({
    R2_ACCOUNT_ID: 'test',
    R2_ACCESS_KEY_ID: 'test',
    R2_SECRET_ACCESS_KEY: 'test',
    R2_BUCKET_NAME: 'test',
    R2_PUBLIC_URL: 'https://test.com',
  }),
}));

describe('Two-factor server functions', () => {
  const mockSession = {
    user: {
      id: 'user-123',
      name: 'Test User',
      email: 'test@example.com',
      role: 'student' as const,
      locale: 'en',
      emailVerified: true,
      image: null,
    },
    session: {
      id: 'session-123',
      token: 'token-abc',
      expiresAt: new Date(Date.now() + 3600000),
    },
  };

  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    transaction: vi.fn(async (callback: any) => callback(mockDb)),
    then: vi.fn(function (onfulfilled: any) {
      return Promise.resolve([]).then(onfulfilled);
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
    vi.mocked(i18nServerMod.resolveEmailSubject).mockReturnValue('resolved-subject');
  });

  // ─── generateTwoFactorSetupHandler ───────────────────────────

  describe('generateTwoFactorSetupHandler', () => {
    it('should return Unauthorized when no session', async () => {
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue(null);

      const result = await generateTwoFactorSetupHandler({
        data: { password: 'testpass123' },
      });

      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should call auth.api.enableTwoFactor and return totpURI + backupCodes', async () => {
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue(mockSession);
      vi.mocked(auth.api.enableTwoFactor).mockResolvedValue({
        totpURI: 'otpauth://totp/SIMAK:test@example.com?secret=ABC123',
        backupCodes: ['code1-code2', 'code3-code4'],
      } as any);

      const result = await generateTwoFactorSetupHandler({
        data: { password: 'testpass123' },
      });

      expect(result).toEqual({
        totpURI: 'otpauth://totp/SIMAK:test@example.com?secret=ABC123',
        backupCodes: ['code1-code2', 'code3-code4'],
      });
      expect(auth.api.enableTwoFactor).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { password: 'testpass123' },
        }),
      );
    });

    it('should log audit event on success', async () => {
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue(mockSession);
      vi.mocked(auth.api.enableTwoFactor).mockResolvedValue({
        totpURI: 'otpauth://...',
        backupCodes: [],
      } as any);

      await generateTwoFactorSetupHandler({
        data: { password: 'testpass123' },
      });

      expect(auditMod.logAuditEvent).toHaveBeenCalledWith({
        actorId: 'user-123',
        action: 'two_factor.setup_initiated',
        entityType: 'user',
        entityId: 'user-123',
      });
    });

    it('should return error on auth failure', async () => {
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue(mockSession);
      vi.mocked(auth.api.enableTwoFactor).mockRejectedValue(new Error('Invalid password'));

      const result = await generateTwoFactorSetupHandler({
        data: { password: 'wrongpass' },
      });

      expect(result).toEqual({ error: { code: 'BAD_REQUEST', message: 'Invalid password' } });
    });
  });

  // ─── enableTwoFactorHandler ──────────────────────────────────

  describe('enableTwoFactorHandler', () => {
    it('should return Unauthorized when no session', async () => {
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue(null);

      const result = await enableTwoFactorHandler({
        data: { code: '123456', trustDevice: false },
      });

      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should verify TOTP code, log audit, and send email', async () => {
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue(mockSession);
      vi.mocked(auth.api.verifyTOTP).mockResolvedValue({} as any);

      const result = await enableTwoFactorHandler({
        data: { code: '123456', trustDevice: true },
      });

      expect(result).toEqual({ success: true });
      expect(auth.api.verifyTOTP).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { code: '123456', trustDevice: true },
        }),
      );
      expect(auditMod.logAuditEvent).toHaveBeenCalledWith({
        actorId: 'user-123',
        action: 'two_factor.enabled',
        entityType: 'user',
        entityId: 'user-123',
      });
      expect(emailMod.enqueueEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientEmail: 'test@example.com',
          subject: 'resolved-subject',
          templateType: 'two_factor',
        }),
      );
      expect(i18nServerMod.resolveEmailSubject).toHaveBeenCalledWith(
        'emails.subjects.twoFactorEnabled',
        undefined,
        'en',
      );
    });

    it('should return error on verification failure', async () => {
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue(mockSession);
      vi.mocked(auth.api.verifyTOTP).mockRejectedValue(new Error('Invalid TOTP code'));

      const result = await enableTwoFactorHandler({
        data: { code: '000000', trustDevice: false },
      });

      expect(result).toEqual({ error: { code: 'BAD_REQUEST', message: 'Invalid TOTP code' } });
    });

    it('escapes malicious user name in enable email body', async () => {
      const maliciousName = 'Eve <script>alert(1)</script>';
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue({
        ...mockSession,
        user: { ...mockSession.user, name: maliciousName },
      });
      vi.mocked(auth.api.verifyTOTP).mockResolvedValue({} as any);

      await enableTwoFactorHandler({ data: { code: '123456', trustDevice: false } });

      const callArg = vi.mocked(emailMod.enqueueEmail).mock.calls[0][0];
      expect(callArg.bodyHtml).toContain('Hi Eve &lt;script&gt;alert(1)&lt;/script&gt;');
      expect(callArg.bodyHtml).not.toContain('<script>alert(1)</script>');
    });

    it('greets the user by name in enable email body for normal input', async () => {
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue(mockSession);
      vi.mocked(auth.api.verifyTOTP).mockResolvedValue({} as any);

      await enableTwoFactorHandler({ data: { code: '123456', trustDevice: false } });

      const callArg = vi.mocked(emailMod.enqueueEmail).mock.calls[0][0];
      expect(callArg.bodyHtml).toContain('Hi Test User,');
    });
  });

  // ─── disableTwoFactorHandler ─────────────────────────────────

  describe('disableTwoFactorHandler', () => {
    beforeEach(() => {
      const mockUpdateSet = vi.fn().mockResolvedValue(undefined);
      const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
      mockDb.update.mockReturnValue({ set: mockUpdateSet } as any);
      mockUpdateSet.mockReturnValue({ where: mockUpdateWhere } as any);
      const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
      mockDb.delete.mockReturnValue({ where: mockDeleteWhere } as any);
    });

    it('should return Unauthorized when no session', async () => {
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue(null);

      const result = await disableTwoFactorHandler({
        data: { password: 'testpass123' },
      });

      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should disable 2FA, update user, delete record, log audit, and send email', async () => {
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue(mockSession);
      vi.mocked(auth.api.disableTwoFactor).mockResolvedValue({} as any);

      const result = await disableTwoFactorHandler({
        data: { password: 'testpass123' },
      });

      expect(result).toEqual({ success: true });
      expect(auth.api.disableTwoFactor).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { password: 'testpass123' },
        }),
      );
      expect(mockDb.delete).toHaveBeenCalled();
      expect(auditMod.logAuditEvent).toHaveBeenCalledWith({
        actorId: 'user-123',
        action: 'two_factor.disabled',
        entityType: 'user',
        entityId: 'user-123',
      });
      expect(emailMod.enqueueEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientEmail: 'test@example.com',
          subject: 'resolved-subject',
          templateType: 'two_factor',
        }),
      );
      expect(i18nServerMod.resolveEmailSubject).toHaveBeenCalledWith(
        'emails.subjects.twoFactorDisabled',
        undefined,
        'en',
      );
    });

    it('should perform DB operations inside a single transaction', async () => {
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue(mockSession);
      vi.mocked(auth.api.disableTwoFactor).mockResolvedValue({} as any);

      await disableTwoFactorHandler({ data: { password: 'testpass123' } });

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should call auth.api.disableTwoFactor after DB commit', async () => {
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue(mockSession);

      const callOrder: string[] = [];
      mockDb.transaction.mockImplementationOnce(async (cb: any) => {
        callOrder.push('transaction');
        await cb(mockDb);
      });
      vi.mocked(auth.api.disableTwoFactor).mockImplementationOnce(async () => {
        callOrder.push('authApi');
        return {} as any;
      });

      await disableTwoFactorHandler({ data: { password: 'testpass123' } });

      expect(callOrder).toEqual(['transaction', 'authApi']);
    });

    it('should not rollback DB if auth API fails post-commit', async () => {
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue(mockSession);
      vi.mocked(auth.api.disableTwoFactor).mockRejectedValue(new Error('Auth API failure'));

      const result = await disableTwoFactorHandler({
        data: { password: 'testpass123' },
      });

      expect(result).toEqual({ success: true });
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it('escapes malicious user name in disable email body', async () => {
      const maliciousName = 'Mallory <img src=x onerror=alert(1)>';
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue({
        ...mockSession,
        user: { ...mockSession.user, name: maliciousName },
      });
      vi.mocked(auth.api.disableTwoFactor).mockResolvedValue({} as any);

      await disableTwoFactorHandler({ data: { password: 'testpass123' } });

      const callArg = vi.mocked(emailMod.enqueueEmail).mock.calls[0][0];
      expect(callArg.bodyHtml).toContain('Hi Mallory &lt;img src=x onerror=alert(1)&gt;');
      expect(callArg.bodyHtml).not.toContain('<img src=x onerror=alert(1)>');
    });

    it('greets the user by name in disable email body for normal input', async () => {
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue(mockSession);
      vi.mocked(auth.api.disableTwoFactor).mockResolvedValue({} as any);

      await disableTwoFactorHandler({ data: { password: 'testpass123' } });

      const callArg = vi.mocked(emailMod.enqueueEmail).mock.calls[0][0];
      expect(callArg.bodyHtml).toContain('Hi Test User,');
    });

    it('should revoke all user sessions after disabling 2FA', async () => {
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue(mockSession);
      vi.mocked(auth.api.disableTwoFactor).mockResolvedValue({} as any);

      await disableTwoFactorHandler({
        data: { password: 'testpass123' },
      });

      expect(authSessionMod.revokeUserSessions).toHaveBeenCalledWith('user-123', 'user-123');
    });
  });

  // ─── regenerateBackupCodesHandler ────────────────────────────

  describe('regenerateBackupCodesHandler', () => {
    it('should return Unauthorized when no session', async () => {
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue(null);

      const result = await regenerateBackupCodesHandler({
        data: { password: 'testpass123' },
      });

      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should call generateBackupCodes and return new codes', async () => {
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue(mockSession);
      vi.mocked(auth.api.generateBackupCodes).mockResolvedValue({
        response: { backupCodes: ['new-code1', 'new-code2'] },
      } as any);

      const result = await regenerateBackupCodesHandler({
        data: { password: 'testpass123' },
      });

      expect(result).toEqual({ backupCodes: ['new-code1', 'new-code2'] });
      expect(auth.api.generateBackupCodes).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { password: 'testpass123' },
        }),
      );
      expect(auditMod.logAuditEvent).toHaveBeenCalledWith({
        actorId: 'user-123',
        action: 'two_factor.backup_codes_regenerated',
        entityType: 'user',
        entityId: 'user-123',
      });
    });

    it('should return error on failure', async () => {
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue(mockSession);
      vi.mocked(auth.api.generateBackupCodes).mockRejectedValue(new Error('Password required'));

      const result = await regenerateBackupCodesHandler({
        data: { password: '' },
      });

      expect(result).toEqual({ error: { code: 'BAD_REQUEST', message: 'Password required' } });
    });
  });

  // ─── getTwoFactorStatusHandler ───────────────────────────────

  describe('getTwoFactorStatusHandler', () => {
    it('should return Unauthorized when no session', async () => {
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue(null);

      const result = await getTwoFactorStatusHandler({ data: {} });

      expect(result).toEqual({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    });

    it('should return enabled: true when 2FA is enabled', async () => {
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue(mockSession);

      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ twoFactorEnabled: true }]).then(onfulfilled),
      );

      const result = await getTwoFactorStatusHandler({ data: {} });

      expect(result).toEqual({ enabled: true });
    });

    it('should return enabled: false when 2FA is not enabled', async () => {
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue(mockSession);

      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([{ twoFactorEnabled: false }]).then(onfulfilled),
      );

      const result = await getTwoFactorStatusHandler({ data: {} });

      expect(result).toEqual({ enabled: false });
    });

    it('should return enabled: false when no user record found', async () => {
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue(mockSession);

      mockDb.then.mockImplementationOnce((onfulfilled: any) =>
        Promise.resolve([]).then(onfulfilled),
      );

      const result = await getTwoFactorStatusHandler({ data: {} });

      expect(result).toEqual({ enabled: false });
    });
  });
});
