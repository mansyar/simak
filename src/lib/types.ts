/**
 * Shared type utilities for the SIMAK application.
 * These types are used across server files to eliminate `any` usage.
 */

/**
 * Non-nullable session shape used by type guards.
 * This is the non-null version of the Session type from src/server/auth.ts.
 */
export type NonNullableSession = {
  user: {
    id: string;
    name: string;
    email: string;
    role: 'superadmin' | 'admin' | 'instructor' | 'student';
    locale: string;
    emailVerified: boolean;
    image?: string | null;
  };
  session: {
    id: string;
    token: string;
    expiresAt: Date;
  };
};

/**
 * Generic wrapper for server function handler args.
 * Used in createServerFn stubs to replace `args: { data: any }`.
 */
export type ServerFnArgs<T = unknown> = {
  data: T;
};
