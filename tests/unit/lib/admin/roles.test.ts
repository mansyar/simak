import { describe, it, expect } from 'vitest';

import { ROLES, getRoleConfig, type RoleConfig } from '@/lib/admin/roles';

describe('ROLES config', () => {
  it('contains all 4 roles', () => {
    expect(ROLES).toHaveLength(4);
  });

  it('has superadmin, admin, instructor, student values', () => {
    const values = ROLES.map((r) => r.value);
    expect(values).toContain('superadmin');
    expect(values).toContain('admin');
    expect(values).toContain('instructor');
    expect(values).toContain('student');
  });

  it('each role has value, labelKey, and badgeVariant', () => {
    for (const role of ROLES) {
      expect(role).toHaveProperty('value');
      expect(role).toHaveProperty('labelKey');
      expect(role).toHaveProperty('badgeVariant');
      expect(typeof role.value).toBe('string');
      expect(typeof role.labelKey).toBe('string');
      expect(typeof role.badgeVariant).toBe('string');
    }
  });

  it('labelKey values start with adminUsers.role_', () => {
    for (const role of ROLES) {
      expect(role.labelKey).toMatch(/^adminUsers\.role_/);
    }
  });
});

describe('getRoleConfig', () => {
  it('returns the correct config for a known role', () => {
    const config = getRoleConfig('superadmin');
    expect(config).toBeDefined();
    expect(config?.value).toBe('superadmin');
    expect(config?.labelKey).toBe('adminUsers.role_superadmin');
    expect(config?.badgeVariant).toBe('default');
  });

  it('returns undefined for an unknown role', () => {
    const config = getRoleConfig('unknown');
    expect(config).toBeUndefined();
  });

  it('returns the correct badgeVariant for admin', () => {
    const config = getRoleConfig('admin');
    expect(config?.badgeVariant).toBe('warning');
  });

  it('returns the correct badgeVariant for instructor', () => {
    const config = getRoleConfig('instructor');
    expect(config?.badgeVariant).toBe('info');
  });

  it('returns the correct badgeVariant for student', () => {
    const config = getRoleConfig('student');
    expect(config?.badgeVariant).toBe('secondary');
  });
});
