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

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: vi.fn().mockReturnValue(new Headers()),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock('@/lib/email', () => ({
  enqueueEmail: vi.fn(),
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
    then: vi.fn(function (onfulfilled: any) {
      return Promise.resolve([]).then(onfulfilled);
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbMod.getDb).mockReturnValue(mockDb as any);
  });

  // ─── generateTwoFactorSetupHandler ───────────────────────────

  describe('generateTwoFactorSetupHandler', () => {
    it('should return Unauthorized when no session', async () => {
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue(null);

      const result = await generateTwoFactorSetupHandler({
        data: { password: 'testpass123' },
      });

      expect(result).toEqual({ error: 'Unauthorized' });
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

      expect(result).toEqual({ error: 'Invalid password' });
    });
  });

  // ─── enableTwoFactorHandler ──────────────────────────────────

  describe('enableTwoFactorHandler', () => {
    it('should return Unauthorized when no session', async () => {
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue(null);

      const result = await enableTwoFactorHandler({
        data: { code: '123456', trustDevice: false },
      });

      expect(result).toEqual({ error: 'Unauthorized' });
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
          subject: 'Two-Factor Authentication Enabled',
        }),
      );
    });

    it('should return error on verification failure', async () => {
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue(mockSession);
      vi.mocked(auth.api.verifyTOTP).mockRejectedValue(new Error('Invalid TOTP code'));

      const result = await enableTwoFactorHandler({
        data: { code: '000000', trustDevice: false },
      });

      expect(result).toEqual({ error: 'Invalid TOTP code' });
    });
  });

  // ─── disableTwoFactorHandler ─────────────────────────────────

  describe('disableTwoFactorHandler', () => {
    it('should return Unauthorized when no session', async () => {
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue(null);

      const result = await disableTwoFactorHandler({
        data: { password: 'testpass123' },
      });

      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should disable 2FA, update user, delete record, log audit, and send email', async () => {
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue(mockSession);
      vi.mocked(auth.api.disableTwoFactor).mockResolvedValue({} as any);

      const mockUpdateSet = vi.fn().mockResolvedValue(undefined);
      const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
      mockDb.update.mockReturnValue({ set: mockUpdateSet } as any);
      mockUpdateSet.mockReturnValue({ where: mockUpdateWhere } as any);

      const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
      mockDb.delete.mockReturnValue({ where: mockDeleteWhere } as any);

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
          subject: 'Two-Factor Authentication Disabled',
        }),
      );
    });

    it('should return error on disable failure', async () => {
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue(mockSession);
      vi.mocked(auth.api.disableTwoFactor).mockRejectedValue(new Error('Wrong password'));

      const result = await disableTwoFactorHandler({
        data: { password: 'wrongpass' },
      });

      expect(result).toEqual({ error: 'Wrong password' });
    });
  });

  // ─── regenerateBackupCodesHandler ────────────────────────────

  describe('regenerateBackupCodesHandler', () => {
    it('should return Unauthorized when no session', async () => {
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue(null);

      const result = await regenerateBackupCodesHandler({
        data: { password: 'testpass123' },
      });

      expect(result).toEqual({ error: 'Unauthorized' });
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

      expect(result).toEqual({ error: 'Password required' });
    });
  });

  // ─── getTwoFactorStatusHandler ───────────────────────────────

  describe('getTwoFactorStatusHandler', () => {
    it('should return Unauthorized when no session', async () => {
      vi.mocked(authMod.getSessionFromHeaders).mockResolvedValue(null);

      const result = await getTwoFactorStatusHandler({ data: {} });

      expect(result).toEqual({ error: 'Unauthorized' });
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
