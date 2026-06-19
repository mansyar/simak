import { describe, it, expect } from 'vitest';
import {
  EnableTwoFactorSchema,
  DisableTwoFactorSchema,
  VerifyTwoFactorSchema,
  VerifyBackupCodeSchema,
  RegenerateBackupCodesSchema,
  GetTwoFactorStatusSchema,
  generateTwoFactorSetup,
  enableTwoFactor,
  disableTwoFactor,
  regenerateBackupCodes,
  getTwoFactorStatus,
} from '@/server/two-factor';
describe('two-factor stubs', () => {
  describe('EnableTwoFactorSchema', () => {
    it('should accept valid password', () => {
      const result = EnableTwoFactorSchema.parse({ password: 'mypassword' });
      expect(result.password).toBe('mypassword');
    });
    it('should reject empty password', () => {
      expect(() => EnableTwoFactorSchema.parse({ password: '' })).toThrow();
    });
    it('should reject missing password', () => {
      expect(() => EnableTwoFactorSchema.parse({})).toThrow();
    });
  });
  describe('DisableTwoFactorSchema', () => {
    it('should accept valid password', () => {
      const result = DisableTwoFactorSchema.parse({ password: 'mypassword' });
      expect(result.password).toBe('mypassword');
    });
    it('should reject empty password', () => {
      expect(() => DisableTwoFactorSchema.parse({ password: '' })).toThrow();
    });
  });
  describe('VerifyTwoFactorSchema', () => {
    it('should accept valid 6-digit code', () => {
      const result = VerifyTwoFactorSchema.parse({ code: '123456' });
      expect(result.code).toBe('123456');
      expect(result.trustDevice).toBe(false);
    });
    it('should accept code with trustDevice', () => {
      const result = VerifyTwoFactorSchema.parse({ code: '123456', trustDevice: true });
      expect(result.trustDevice).toBe(true);
    });
    it('should reject code shorter than 6 digits', () => {
      expect(() => VerifyTwoFactorSchema.parse({ code: '12345' })).toThrow();
    });
  });
  describe('VerifyBackupCodeSchema', () => {
    it('should accept valid backup code', () => {
      const result = VerifyBackupCodeSchema.parse({ code: 'ABCD-1234' });
      expect(result.code).toBe('ABCD-1234');
    });
    it('should reject empty backup code', () => {
      expect(() => VerifyBackupCodeSchema.parse({ code: '' })).toThrow();
    });
  });
  describe('RegenerateBackupCodesSchema', () => {
    it('should accept valid password', () => {
      const result = RegenerateBackupCodesSchema.parse({ password: 'mypassword' });
      expect(result.password).toBe('mypassword');
    });
  });
  describe('GetTwoFactorStatusSchema', () => {
    it('should accept empty object', () => {
      const result = GetTwoFactorStatusSchema.parse({});
      expect(result).toEqual({});
    });
  });
  it('should export generateTwoFactorSetup server function', () => {
    expect(generateTwoFactorSetup).toBeDefined();
    expect(typeof generateTwoFactorSetup).toBe('function');
  });
  it('should export enableTwoFactor server function', () => {
    expect(enableTwoFactor).toBeDefined();
    expect(typeof enableTwoFactor).toBe('function');
  });
  it('should export disableTwoFactor server function', () => {
    expect(disableTwoFactor).toBeDefined();
    expect(typeof disableTwoFactor).toBe('function');
  });
  it('should export regenerateBackupCodes server function', () => {
    expect(regenerateBackupCodes).toBeDefined();
    expect(typeof regenerateBackupCodes).toBe('function');
  });
  it('should export getTwoFactorStatus server function', () => {
    expect(getTwoFactorStatus).toBeDefined();
    expect(typeof getTwoFactorStatus).toBe('function');
  });
});
