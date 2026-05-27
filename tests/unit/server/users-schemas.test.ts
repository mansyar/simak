/** @vitest-environment node */
import { describe, it, expect, vi } from 'vitest';

// Mock createServerFn before importing
vi.mock('@tanstack/react-start', () => ({
  createServerFn: vi.fn().mockReturnValue({
    handler: vi.fn().mockImplementation((fn) => fn),
  }),
}));

import {
  CreateUserSchema,
  UpdateUserSchema,
  ListUsersSchema,
  UserIdParamSchema,
} from '@/server/users';

describe('User Schemas', () => {
  describe('CreateUserSchema', () => {
    it('should accept valid user', () => {
      const result = CreateUserSchema.safeParse({
        name: 'John Doe',
        email: 'john@example.com',
        role: 'student',
      });
      expect(result.success).toBe(true);
    });

    it('should accept admin role', () => {
      const result = CreateUserSchema.safeParse({
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'admin',
      });
      expect(result.success).toBe(true);
    });

    it('should accept instructor role', () => {
      const result = CreateUserSchema.safeParse({
        name: 'Instructor User',
        email: 'instructor@example.com',
        role: 'instructor',
      });
      expect(result.success).toBe(true);
    });

    it('should reject superadmin role', () => {
      const result = CreateUserSchema.safeParse({
        name: 'Super Admin',
        email: 'super@example.com',
        role: 'superadmin',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid email', () => {
      const result = CreateUserSchema.safeParse({
        name: 'John Doe',
        email: 'invalid-email',
        role: 'student',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const result = CreateUserSchema.safeParse({
        name: '',
        email: 'john@example.com',
        role: 'student',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid role', () => {
      const result = CreateUserSchema.safeParse({
        name: 'John Doe',
        email: 'john@example.com',
        role: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('UpdateUserSchema', () => {
    it('should accept valid update', () => {
      const result = UpdateUserSchema.safeParse({
        name: 'Updated Name',
        email: 'updated@example.com',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const result = UpdateUserSchema.safeParse({
        name: '',
        email: 'updated@example.com',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid email', () => {
      const result = UpdateUserSchema.safeParse({
        name: 'Updated Name',
        email: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ListUsersSchema', () => {
    it('should accept empty input with defaults', () => {
      const result = ListUsersSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
        expect(result.data.search).toBe('');
        expect(result.data.role).toBeUndefined();
      }
    });

    it('should accept custom filters', () => {
      const result = ListUsersSchema.safeParse({
        page: 2,
        limit: 50,
        search: 'john',
        role: 'student',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(50);
        expect(result.data.search).toBe('john');
        expect(result.data.role).toBe('student');
      }
    });

    it('should accept all valid roles', () => {
      for (const role of ['superadmin', 'admin', 'instructor', 'student']) {
        const result = ListUsersSchema.safeParse({ role });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid role', () => {
      const result = ListUsersSchema.safeParse({ role: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should reject page less than 1', () => {
      const result = ListUsersSchema.safeParse({ page: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject limit greater than 500', () => {
      const result = ListUsersSchema.safeParse({ limit: 501 });
      expect(result.success).toBe(false);
    });
  });

  describe('UserIdParamSchema', () => {
    it('should accept valid ID', () => {
      const result = UserIdParamSchema.safeParse({ id: 'user-123' });
      expect(result.success).toBe(true);
    });

    it('should reject empty ID', () => {
      const result = UserIdParamSchema.safeParse({ id: '' });
      expect(result.success).toBe(false);
    });
  });
});
