/**
 * Role-based creation allowlist — canonical source of truth.
 *   superadmin → admin only
 *   admin      → instructor, student only
 * superadmin is never creatable via import (per spec FR-1).
 *
 * Import this wherever role-creation boundaries are enforced
 * (single-create, bulk-import server, client-side parser).
 */
export const CREATION_ALLOWED_ROLES: Record<string, readonly string[]> = {
  superadmin: ['admin'],
  admin: ['instructor', 'student'],
};
