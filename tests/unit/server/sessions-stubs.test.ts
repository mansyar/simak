import { describe, it, expect } from 'vitest';
import {
  RevokeSessionSchema,
  listActiveSessions,
  revokeSession,
  revokeAllOtherSessions,
} from '@/server/sessions';

describe('sessions stubs', () => {
  describe('RevokeSessionSchema', () => {
    it('should accept valid session ID', () => {
      const result = RevokeSessionSchema.parse({ sessionId: 'session-123' });
      expect(result.sessionId).toBe('session-123');
    });

    it('should reject empty session ID', () => {
      expect(() => RevokeSessionSchema.parse({ sessionId: '' })).toThrow();
    });

    it('should reject missing session ID', () => {
      expect(() => RevokeSessionSchema.parse({})).toThrow();
    });
  });

  it('should export listActiveSessions server function', () => {
    expect(listActiveSessions).toBeDefined();
    expect(typeof listActiveSessions).toBe('object');
  });

  it('should export revokeSession server function', () => {
    expect(revokeSession).toBeDefined();
    expect(typeof revokeSession).toBe('object');
  });

  it('should export revokeAllOtherSessions server function', () => {
    expect(revokeAllOtherSessions).toBeDefined();
    expect(typeof revokeAllOtherSessions).toBe('object');
  });
});
