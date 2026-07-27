import { describe, it, expect } from 'vitest';
import { isAdmin, isInstructor, isStudent, isAuthenticated } from '@/lib/session-guards';
import type { NonNullableSession } from '@/lib/types';

function makeSession(role: NonNullableSession['user']['role']): NonNullableSession {
  return {
    user: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      role,
      locale: 'en',
      emailVerified: true,
      image: null,
    },
    session: {
      id: 'session-1',
      token: 'token-abc',
      expiresAt: new Date('2026-12-31'),
    },
  };
}

describe('isAdmin', () => {
  it('should return true for superadmin', () => {
    expect(isAdmin(makeSession('superadmin'))).toBe(true);
  });

  it('should return true for admin', () => {
    expect(isAdmin(makeSession('admin'))).toBe(true);
  });

  it('should return false for instructor', () => {
    expect(isAdmin(makeSession('instructor'))).toBe(false);
  });

  it('should return false for student', () => {
    expect(isAdmin(makeSession('student'))).toBe(false);
  });

  it('should return false for null', () => {
    expect(isAdmin(null)).toBe(false);
  });
});

describe('isInstructor', () => {
  it('should return true for instructor', () => {
    expect(isInstructor(makeSession('instructor'))).toBe(true);
  });

  it('should return false for superadmin', () => {
    expect(isInstructor(makeSession('superadmin'))).toBe(false);
  });

  it('should return false for admin', () => {
    expect(isInstructor(makeSession('admin'))).toBe(false);
  });

  it('should return false for student', () => {
    expect(isInstructor(makeSession('student'))).toBe(false);
  });

  it('should return false for null', () => {
    expect(isInstructor(null)).toBe(false);
  });
});

describe('isStudent', () => {
  it('should return true for student', () => {
    expect(isStudent(makeSession('student'))).toBe(true);
  });

  it('should return false for superadmin', () => {
    expect(isStudent(makeSession('superadmin'))).toBe(false);
  });

  it('should return false for admin', () => {
    expect(isStudent(makeSession('admin'))).toBe(false);
  });

  it('should return false for instructor', () => {
    expect(isStudent(makeSession('instructor'))).toBe(false);
  });

  it('should return false for null', () => {
    expect(isStudent(null)).toBe(false);
  });
});

describe('isAuthenticated', () => {
  it('should return true for superadmin session', () => {
    expect(isAuthenticated(makeSession('superadmin'))).toBe(true);
  });

  it('should return true for admin session', () => {
    expect(isAuthenticated(makeSession('admin'))).toBe(true);
  });

  it('should return true for instructor session', () => {
    expect(isAuthenticated(makeSession('instructor'))).toBe(true);
  });

  it('should return true for student session', () => {
    expect(isAuthenticated(makeSession('student'))).toBe(true);
  });

  it('should return false for null', () => {
    expect(isAuthenticated(null)).toBe(false);
  });
});
