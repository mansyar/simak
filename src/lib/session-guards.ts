/**
 * Shared session type-guard functions.
 *
 * Client-safe — no server-only imports (no drizzle, no DB, no auth config).
 * These guards centralize the role-check pattern that was previously duplicated
 * across 20 `*.server.ts` files.
 */
import type { NonNullableSession } from './types';

export function isAdmin(session: NonNullableSession | null): session is NonNullableSession {
  return !!session && (session.user.role === 'superadmin' || session.user.role === 'admin');
}

export function isInstructor(session: NonNullableSession | null): session is NonNullableSession {
  return !!session && session.user.role === 'instructor';
}

export function isStudent(session: NonNullableSession | null): session is NonNullableSession {
  return !!session && session.user.role === 'student';
}

export function isAuthenticated(session: NonNullableSession | null): session is NonNullableSession {
  return !!session;
}
